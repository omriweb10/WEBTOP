/**
 * Local API gateway with the same URL layout as a hosted Supabase project:
 *   /auth/v1/*      → Supabase Auth (GoTrue binary)
 *   /rest/v1/*      → PostgREST binary
 *   /functions/v1/* → Edge Functions (Deno, real handler code)
 *   /storage/v1/*   → TEST-ONLY storage emulator (below)
 * The storage emulator authorises every operation by running the same SQL that Supabase
 * Storage runs: it switches to the caller's role/JWT claims and reads or writes
 * storage.objects, so the bucket's RLS policies and limits are genuinely enforced.
 */
import { createHmac, randomUUID } from 'node:crypto';
import http from 'node:http';
import pg from 'pg';
import { ANON_KEY, DB_URL, JWT_SECRET, PORTS } from './config.mjs';

const UPSTREAMS = {
  '/auth/v1': PORTS.gotrue,
  '/rest/v1': PORTS.postgrest,
  '/functions/v1': PORTS.functions,
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, prefer, accept-profile, content-profile, range, x-upsert, cache-control, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
  'Access-Control-Expose-Headers': 'content-range, content-type, retry-after',
};

const pool = new pg.Pool({ connectionString: DB_URL, max: 10 });
/** In-memory object bytes keyed by "bucket/name". */
const blobs = new Map();

/** Verifies an HS256 JWT and returns its claims, or null. */
function verifyJwt(token) {
  const [header, payload, signature] = (token ?? '').split('.');
  if (!header || !payload || !signature) return null;
  const expected = createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  if (expected !== signature) return null;
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (claims.exp && claims.exp * 1000 < Date.now()) return null;
  return claims;
}

/** Claims of the request's bearer token (falls back to the anon key like Supabase's gateway). */
function requestClaims(req) {
  const auth = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
  return verifyJwt(auth ?? req.headers.apikey ?? ANON_KEY);
}

/** Runs SQL as the caller (role + request.jwt.claims), exactly like Supabase Storage. */
async function asCaller(claims, fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const role = ['anon', 'authenticated', 'service_role'].includes(claims.role) ? claims.role : 'anon';
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Reads the whole request body. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Sends a JSON response with CORS headers. */
function sendJson(res, status, body) {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** Signs a short-lived download token for one object. */
function signDownload(bucket, name, expiresIn) {
  const exp = Math.floor(Date.now() / 1000) + expiresIn;
  const payload = Buffer.from(JSON.stringify({ url: `${bucket}/${name}`, exp })).toString('base64url');
  return `${payload}.${createHmac('sha256', JWT_SECRET).update(payload).digest('base64url')}`;
}

/**
 * The uploaded file from a raw or multipart body. supabase-js sends Blob/File uploads as
 * multipart/form-data (one part per field; the file part carries its own Content-Type).
 */
function uploadedFile(body, contentType) {
  const boundary = /^multipart\/form-data;.*boundary=("?)([^";]+)\1/i.exec(contentType)?.[2];
  if (!boundary) return { bytes: body, type: contentType.split(';')[0].trim() };
  const delimiter = Buffer.from(`--${boundary}`);
  let start = body.indexOf(delimiter);
  while (start !== -1) {
    const next = body.indexOf(delimiter, start + delimiter.length);
    if (next === -1) break;
    const part = body.subarray(start + delimiter.length + 2, next - 2);
    const split = part.indexOf('\r\n\r\n');
    const headers = part.subarray(0, split).toString();
    const type = /content-type:\s*([^\r\n;]+)/i.exec(headers)?.[1];
    if (type) return { bytes: part.subarray(split + 4), type: type.trim() };
    start = next;
  }
  return { bytes: Buffer.alloc(0), type: 'application/octet-stream' };
}

/** Storage API subset used by the app: upload, remove, sign, download. */
async function handleStorage(req, res, path) {
  const claims = requestClaims(req);
  const url = new URL(req.url, 'http://local');
  let match;
  try {
    if (req.method === 'GET' && (match = /^\/object\/sign\/([^/]+)\/(.+)$/.exec(path))) {
      const [payload, sig] = (url.searchParams.get('token') ?? '').split('.');
      const valid = payload && sig === createHmac('sha256', JWT_SECRET).update(payload).digest('base64url');
      const data = valid ? JSON.parse(Buffer.from(payload, 'base64url').toString()) : null;
      const key = `${match[1]}/${decodeURIComponent(match[2])}`;
      if (!data || data.url !== key || data.exp * 1000 < Date.now() || !blobs.has(key)) return sendJson(res, 400, { error: 'InvalidSignature' });
      const blob = blobs.get(key);
      res.writeHead(200, { ...CORS, 'Content-Type': blob.type, 'Cache-Control': 'private, max-age=3600' });
      return res.end(blob.bytes);
    }
    if (!claims) return sendJson(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'invalid jwt' });

    if (req.method === 'POST' && (match = /^\/object\/sign\/([^/]+)$/.exec(path))) {
      const bucket = match[1];
      const { expiresIn = 3600, paths = [] } = JSON.parse((await readBody(req)).toString() || '{}');
      const found = await asCaller(claims, (c) =>
        c.query('select name from storage.objects where bucket_id = $1 and name = any($2)', [bucket, paths]),
      );
      const visible = new Set(found.rows.map((r) => r.name));
      return sendJson(
        res,
        200,
        paths.map((name) =>
          visible.has(name)
            ? { error: null, path: name, signedURL: `/object/sign/${bucket}/${encodeURI(name)}?token=${signDownload(bucket, name, expiresIn)}` }
            : { error: 'Either the object does not exist or you do not have access to it', path: name, signedURL: null },
        ),
      );
    }

    if (req.method === 'POST' && (match = /^\/object\/sign\/([^/]+)\/(.+)$/.exec(path))) {
      const [bucket, name] = [match[1], decodeURIComponent(match[2])];
      const { expiresIn = 3600 } = JSON.parse((await readBody(req)).toString() || '{}');
      const found = await asCaller(claims, (c) =>
        c.query('select 1 from storage.objects where bucket_id = $1 and name = $2', [bucket, name]),
      );
      if (found.rowCount === 0) return sendJson(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
      return sendJson(res, 200, { signedURL: `/object/sign/${bucket}/${encodeURI(name)}?token=${signDownload(bucket, name, expiresIn)}` });
    }

    if ((req.method === 'POST' || req.method === 'PUT') && (match = /^\/object\/([^/]+)\/(.+)$/.exec(path))) {
      const [bucket, name] = [match[1], decodeURIComponent(match[2])];
      const { bytes, type } = uploadedFile(await readBody(req), req.headers['content-type'] ?? 'application/octet-stream');
      const { rows } = await pool.query('select file_size_limit, allowed_mime_types from storage.buckets where id = $1', [bucket]);
      const bucketRow = rows[0];
      if (!bucketRow) return sendJson(res, 400, { statusCode: '404', error: 'Bucket not found' });
      if (bucketRow.file_size_limit && bytes.length > Number(bucketRow.file_size_limit)) {
        return sendJson(res, 413, { statusCode: '413', error: 'Payload too large' });
      }
      if (bucketRow.allowed_mime_types && !bucketRow.allowed_mime_types.includes(type)) {
        return sendJson(res, 415, { statusCode: '415', error: 'invalid_mime_type' });
      }
      const upsert = req.headers['x-upsert'] === 'true';
      const sql = `insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, $4)
                   ${upsert ? 'on conflict (bucket_id, name) do update set metadata = excluded.metadata, updated_at = now()' : ''}
                   returning id`;
      const inserted = await asCaller(claims, (c) =>
        c.query(sql, [bucket, name, claims.sub ?? null, { mimetype: type, size: bytes.length }]),
      );
      blobs.set(`${bucket}/${name}`, { bytes, type });
      return sendJson(res, 200, { Key: `${bucket}/${name}`, Id: inserted.rows[0]?.id ?? randomUUID() });
    }

    if (req.method === 'DELETE' && (match = /^\/object\/([^/]+)$/.exec(path))) {
      const bucket = match[1];
      const { prefixes = [] } = JSON.parse((await readBody(req)).toString() || '{}');
      const deleted = await asCaller(claims, (c) =>
        c.query('delete from storage.objects where bucket_id = $1 and name = any($2) returning name', [bucket, prefixes]),
      );
      deleted.rows.forEach((r) => blobs.delete(`${bucket}/${r.name}`));
      return sendJson(res, 200, deleted.rows.map((r) => ({ name: r.name, bucket_id: bucket })));
    }
    return sendJson(res, 404, { error: 'not_found' });
  } catch (error) {
    const rls = /row-level security|permission denied/i.test(String(error.message));
    return sendJson(res, rls ? 403 : 400, { statusCode: rls ? '403' : '400', error: rls ? 'Unauthorized' : 'Error', message: error.message });
  }
}

/** Streams a request to an upstream service. */
function proxy(req, res, port, path) {
  const headers = { ...req.headers, host: `127.0.0.1:${port}` };
  headers['x-forwarded-for'] ??= req.socket.remoteAddress ?? '127.0.0.1';
  const upstream = http.request({ host: '127.0.0.1', port, path, method: req.method, headers }, (up) => {
    // Upstream services send their own CORS headers; keep exactly one set (browsers reject duplicates).
    const headers = Object.fromEntries(Object.entries(up.headers).filter(([name]) => !name.startsWith('access-control-')));
    res.writeHead(up.statusCode ?? 502, { ...headers, ...CORS });
    up.pipe(res);
  });
  upstream.on('error', (error) => sendJson(res, 502, { error: 'bad_gateway', message: error.message }));
  req.pipe(upstream);
}

/** Starts the gateway and resolves once it is listening. */
export function startGateway() {
  const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      return res.end();
    }
    const url = req.url ?? '/';
    if (url.startsWith('/storage/v1/')) return void handleStorage(req, res, url.slice('/storage/v1'.length).split('?')[0]);
    for (const [prefix, port] of Object.entries(UPSTREAMS)) {
      if (url.startsWith(`${prefix}/`) || url === prefix) return proxy(req, res, port, url.slice(prefix.length) || '/');
    }
    if (url === '/health') return sendJson(res, 200, { ok: true });
    return sendJson(res, 404, { error: 'not_found' });
  });
  return new Promise((resolve) => server.listen(PORTS.gateway, '127.0.0.1', () => resolve(server)));
}
