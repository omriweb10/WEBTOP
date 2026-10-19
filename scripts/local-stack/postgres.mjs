/** Creates, starts and stops a throwaway PostgreSQL cluster for the local stack. */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PORTS } from './config.mjs';

export const PG_DATA = path.join(os.tmpdir(), 'webtop-local-stack', 'pgdata');
const LOG_FILE = path.join(os.tmpdir(), 'webtop-local-stack', 'postgres.log');
const SOCKET_DIR = path.join(os.tmpdir(), 'webtop-local-stack');
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

/** Finds the PostgreSQL server binaries (PG_BIN, then the newest /usr/lib/postgresql/<v>/bin). */
export function pgBinDir() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  const base = '/usr/lib/postgresql';
  if (existsSync(base)) {
    const versions = readdirSync(base).filter((v) => /^\d+$/.test(v)).sort((a, b) => Number(b) - Number(a));
    for (const v of versions) if (existsSync(path.join(base, v, 'bin', 'initdb'))) return path.join(base, v, 'bin');
  }
  try {
    return execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('PostgreSQL server binaries not found; set PG_BIN');
  }
}

/** Runs a PostgreSQL binary, as the "postgres" OS user when we are root (initdb refuses root). */
function runPg(binary, args) {
  const exe = path.join(pgBinDir(), binary);
  const [cmd, cmdArgs] = isRoot ? ['runuser', ['-u', 'postgres', '--', exe, ...args]] : [exe, args];
  const result = spawnSync(cmd, cmdArgs, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${binary} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}

/** Initialises a fresh cluster with a "postgres" superuser and trust auth on localhost. */
export function initCluster() {
  rmSync(SOCKET_DIR, { recursive: true, force: true });
  mkdirSync(PG_DATA, { recursive: true });
  if (isRoot) execFileSync('chown', ['-R', 'postgres:postgres', SOCKET_DIR]);
  runPg('initdb', ['-D', PG_DATA, '-U', 'postgres', '--auth=trust', '--encoding=UTF8', '--locale=C.UTF-8']);
}

/** Starts the cluster on 127.0.0.1:PORTS.postgres and waits until it accepts connections. */
export function startCluster() {
  const options = `-p ${PORTS.postgres} -c listen_addresses=127.0.0.1 -k ${SOCKET_DIR} -c max_connections=200 -c fsync=off`;
  runPg('pg_ctl', ['-D', PG_DATA, '-l', LOG_FILE, '-o', options, '-w', 'start']);
}

/** Stops the cluster if it is running. */
export function stopCluster() {
  if (!existsSync(path.join(PG_DATA, 'postmaster.pid'))) return;
  try {
    runPg('pg_ctl', ['-D', PG_DATA, '-m', 'fast', '-w', 'stop']);
  } catch {
    /* already stopped */
  }
}

/** Executes a SQL file with psql (stops on the first error). */
export function psqlFile(file, user = 'postgres') {
  const psql = path.join(pgBinDir(), 'psql');
  const result = spawnSync(psql, ['-h', '127.0.0.1', '-p', String(PORTS.postgres), '-U', user, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-f', file], {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`psql ${path.basename(file)} failed:\n${result.stderr}`);
}

/** Executes a SQL string with psql. */
export function psqlCommand(sql, user = 'postgres') {
  const psql = path.join(pgBinDir(), 'psql');
  const result = spawnSync(psql, ['-h', '127.0.0.1', '-p', String(PORTS.postgres), '-U', user, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-c', sql], {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`psql failed:\n${result.stderr}`);
  return result.stdout;
}
