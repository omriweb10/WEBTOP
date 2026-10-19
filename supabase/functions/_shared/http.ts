/** HTTP helpers shared by the Edge Functions (CORS, JSON responses, bounded body parsing). */

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

/** JSON response with CORS and no-store caching (responses can carry credentials). */
export function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

/** Standard error body: a stable machine code plus an optional detail. */
export function errorResponse(status: number, error: string, extra: Record<string, unknown> = {}): Response {
  return json(status, { error, ...extra });
}

/** Parses a JSON object body of at most `maxBytes`; returns null when invalid. */
export async function readJsonObject(req: Request, maxBytes = 4096): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length === 0 || text.length > maxBytes) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Best-effort client IP from the platform's forwarding headers. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
}

/** Extracts the bearer token from the Authorization header. */
export function bearerToken(req: Request): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '');
  return match?.[1]?.trim() || null;
}

/** Decodes (without verifying) the payload of a JWT we just received from Supabase Auth. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}
