/**
 * Builds the app in account mode against the running local stack (its URL and the anon
 * key generated for this run) into dist-account/, for the account-mode e2e tests.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { ENV_FILE, ROOT } from './config.mjs';

if (!existsSync(ENV_FILE)) {
  console.error('The local stack is not running (missing .local-stack/env.json). Start it with: npm run stack');
  process.exit(1);
}
const env = JSON.parse(readFileSync(ENV_FILE, 'utf8'));
const result = spawnSync('npx', ['vite', 'build', '--outDir', 'dist-account', '--emptyOutDir'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, VITE_SUPABASE_URL: env.apiUrl, VITE_SUPABASE_ANON_KEY: env.anonKey },
});
process.exit(result.status ?? 1);
