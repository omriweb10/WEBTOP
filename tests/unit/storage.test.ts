import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createMemoryStore } from '../../src/services/storage/keyValueStore';
import { clearValue, loadValue, saveValue, type PersistedValueSpec } from '../../src/services/storage/persistedValue';

const Schema = z.object({ name: z.string().min(1), count: z.number().int() });
type Value = z.infer<typeof Schema>;

const spec: PersistedValueSpec<Value> = {
  key: 'test:value',
  version: 2,
  schema: Schema,
  defaults: () => ({ name: 'default', count: 0 }),
  migrations: {
    // v1 stored { title } — renamed to { name, count }
    1: (data) => ({ name: (data as { title: string }).title, count: 0 }),
  },
};

describe('persisted value storage', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadValue(createMemoryStore(), spec)).toEqual({ value: { name: 'default', count: 0 }, status: 'missing' });
  });

  it('round-trips a saved value inside a versioned envelope', () => {
    const store = createMemoryStore();
    expect(saveValue(store, spec, { name: 'x', count: 3 })).toEqual({ ok: true });
    const raw = JSON.parse(store.get(spec.key) ?? '{}');
    expect(raw.schemaVersion).toBe(2);
    expect(loadValue(store, spec)).toEqual({ value: { name: 'x', count: 3 }, status: 'ok' });
  });

  it('refuses to save invalid data', () => {
    const store = createMemoryStore();
    const result = saveValue(store, spec, { name: '', count: 1 });
    expect(result.ok).toBe(false);
    expect(store.get(spec.key)).toBeNull();
  });

  it('migrates older versions', () => {
    const store = createMemoryStore({
      [spec.key]: JSON.stringify({ schemaVersion: 1, savedAt: '', data: { title: 'old' } }),
    });
    expect(loadValue(store, spec)).toEqual({ value: { name: 'old', count: 0 }, status: 'migrated' });
  });

  it.each([
    ['unparsable JSON', '{not json'],
    ['unknown envelope', JSON.stringify({ hello: 1 })],
    ['schema violation', JSON.stringify({ schemaVersion: 2, savedAt: '', data: { name: 5 } })],
    ['newer version', JSON.stringify({ schemaVersion: 9, savedAt: '', data: { name: 'x', count: 1 } })],
  ])('quarantines %s and falls back to defaults', (_label, raw) => {
    const store = createMemoryStore({ [spec.key]: raw });
    const result = loadValue(store, spec);
    expect(result.status).toBe('corrupt');
    expect(result.value).toEqual(spec.defaults());
    expect(result.quarantinedAs && store.get(result.quarantinedAs)).toBe(raw);
  });

  it('keeps at most three quarantined copies', () => {
    const store = createMemoryStore();
    for (let i = 0; i < 5; i += 1) {
      store.set(spec.key, 'broken');
      loadValue(store, spec);
      // distinct timestamps
      store.set(`${spec.key}.corrupt.${1000 + i}`, 'old');
    }
    expect(store.keys().filter((k) => k.startsWith(`${spec.key}.corrupt.`)).length).toBeLessThanOrEqual(4);
  });

  it('reports a failed write instead of throwing', () => {
    const store = createMemoryStore();
    store.set = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    expect(saveValue(store, spec, { name: 'x', count: 1 })).toEqual({ ok: false, error: 'אין מספיק מקום באחסון המקומי' });
  });

  it('clears a value', () => {
    const store = createMemoryStore();
    saveValue(store, spec, { name: 'x', count: 1 });
    clearValue(store, spec);
    expect(loadValue(store, spec).status).toBe('missing');
  });
});
