/** Downloads (once) the pinned PostgREST and Supabase Auth binaries used by the local stack. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { BIN_DIR, VERSIONS } from './config.mjs';

export const POSTGREST_BIN = path.join(BIN_DIR, 'postgrest');
export const GOTRUE_DIR = path.join(BIN_DIR, 'auth');
export const GOTRUE_BIN = path.join(GOTRUE_DIR, 'auth');

/** Fetches a URL to a file with curl (honours the environment's proxy settings). */
function download(url, file) {
  execFileSync('curl', ['-sSfL', '--retry', '3', '-o', file, url], { stdio: 'inherit' });
}

/** Ensures both binaries exist, downloading them from their official GitHub releases. */
export function ensureBinaries() {
  mkdirSync(BIN_DIR, { recursive: true });
  if (!existsSync(POSTGREST_BIN)) {
    const archive = path.join(BIN_DIR, 'postgrest.tar.xz');
    download(
      `https://github.com/PostgREST/postgrest/releases/download/${VERSIONS.postgrest}/postgrest-${VERSIONS.postgrest}-linux-static-x64.tar.xz`,
      archive,
    );
    execFileSync('tar', ['xJf', archive, '-C', BIN_DIR]);
  }
  if (!existsSync(GOTRUE_BIN)) {
    const archive = path.join(BIN_DIR, 'auth.tar.gz');
    download(`https://github.com/supabase/auth/releases/download/${VERSIONS.auth}/auth-${VERSIONS.auth}-x86.tar.gz`, archive);
    mkdirSync(GOTRUE_DIR, { recursive: true });
    execFileSync('tar', ['xzf', archive, '-C', GOTRUE_DIR]);
  }
}
