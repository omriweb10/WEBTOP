/**
 * Versioned, validated persistence for one value.
 *
 * Every value is stored inside an envelope `{ schemaVersion, savedAt, data }`.
 * Loading:
 *   missing           → defaults
 *   unparsable / invalid / newer-than-app → raw value is quarantined under a
 *                       "<key>.corrupt.<timestamp>" key, defaults are used, and the
 *                       problem is reported (never silently discarded)
 *   older version     → migrations run step by step, then the result is validated
 * Saving validates first, so invalid state is never written.
 */
import { z } from 'zod';
import type { KeyValueStore } from './keyValueStore';

export interface PersistedValueSpec<T> {
  key: string;
  /** Current schema version written by this build. */
  version: number;
  schema: z.ZodType<T>;
  defaults: () => T;
  /** migrations[n] converts data saved at version n into version n + 1. */
  migrations?: Readonly<Record<number, (data: unknown) => unknown>>;
}

export type LoadStatus = 'ok' | 'missing' | 'migrated' | 'corrupt';

export interface LoadResult<T> {
  value: T;
  status: LoadStatus;
  /** Human-readable reason when status is 'corrupt'. */
  problem?: string;
  /** Key under which the unreadable raw value was preserved. */
  quarantinedAs?: string;
}

export type SaveResult = { ok: true } | { ok: false; error: string };

const EnvelopeSchema = z.object({
  schemaVersion: z.number().int().min(1),
  savedAt: z.string(),
  data: z.unknown(),
});

const MAX_QUARANTINED_PER_KEY = 3;

/** Summarises zod issues into one short line for logs and the UI. */
export function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

/** Preserves an unreadable raw value and prunes older quarantined copies of the same key. */
export function quarantine(store: KeyValueStore, key: string, raw: string, now = Date.now()): string {
  const quarantineKey = `${key}.corrupt.${now}`;
  try {
    store.set(quarantineKey, raw);
  } catch {
    // Out of space: losing the quarantine copy is acceptable, the live key is reset anyway.
  }
  const prefix = `${key}.corrupt.`;
  const copies = store
    .keys()
    .filter((k) => k.startsWith(prefix))
    .sort();
  copies.slice(0, Math.max(0, copies.length - MAX_QUARANTINED_PER_KEY)).forEach((k) => store.remove(k));
  return quarantineKey;
}

/** Loads, migrates and validates a value; always returns something usable. */
export function loadValue<T>(store: KeyValueStore, spec: PersistedValueSpec<T>): LoadResult<T> {
  const raw = store.get(spec.key);
  if (raw === null) return { value: spec.defaults(), status: 'missing' };

  const fail = (problem: string): LoadResult<T> => ({
    value: spec.defaults(),
    status: 'corrupt',
    problem,
    quarantinedAs: quarantine(store, spec.key, raw),
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail('JSON לא תקין');
  }
  const envelope = EnvelopeSchema.safeParse(parsed);
  if (!envelope.success) return fail('מבנה שמירה לא מוכר');

  let { schemaVersion, data } = envelope.data;
  if (schemaVersion > spec.version) {
    return fail(`הנתונים נשמרו בגרסה חדשה יותר (${schemaVersion}) מזו של האפליקציה (${spec.version})`);
  }
  const migrated = schemaVersion < spec.version;
  while (schemaVersion < spec.version) {
    const migrate = spec.migrations?.[schemaVersion];
    if (!migrate) return fail(`אין המרה מגרסה ${schemaVersion}`);
    try {
      data = migrate(data);
    } catch {
      return fail(`ההמרה מגרסה ${schemaVersion} נכשלה`);
    }
    schemaVersion += 1;
  }

  const result = spec.schema.safeParse(data);
  if (!result.success) return fail(describeIssues(result.error));
  return { value: result.data, status: migrated ? 'migrated' : 'ok' };
}

/** Validates and writes a value inside a fresh envelope. */
export function saveValue<T>(store: KeyValueStore, spec: PersistedValueSpec<T>, value: T, now = new Date()): SaveResult {
  const result = spec.schema.safeParse(value);
  if (!result.success) return { ok: false, error: `נתונים לא תקינים: ${describeIssues(result.error)}` };
  try {
    store.set(
      spec.key,
      JSON.stringify({ schemaVersion: spec.version, savedAt: now.toISOString(), data: result.data }),
    );
    return { ok: true };
  } catch (error) {
    const quota = error instanceof DOMException && /quota/i.test(error.name);
    return { ok: false, error: quota ? 'אין מספיק מקום באחסון המקומי' : 'השמירה לאחסון המקומי נכשלה' };
  }
}

/** Deletes the stored value so the next load returns defaults. */
export function clearValue<T>(store: KeyValueStore, spec: PersistedValueSpec<T>): void {
  store.remove(spec.key);
}
