import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flatRulePaths, flattenPaths, PATH_KEYED } from './rule-paths.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** What Foundry does to a stored document: every dotted key becomes nested objects. */
function expand(value) {
  if (Array.isArray(value)) {
    return value.map(expand);
  }

  if (!value || typeof value != 'object') {
    return value;
  }

  const out = {};
  for (const [key, inner] of Object.entries(value)) {
    const parts = key.split('.');
    let at = out;
    for (const part of parts.slice(0, -1)) {
      at = at[part] ??= {};
    }

    at[parts.at(-1)] = expand(inner);
  }

  return out;
}

describe('rule-paths', () => {
  test('flattenPaths: nested objects become dotted paths; arrays and plain values are leaves', () => {
    expect(flattenPaths({ flags: { essence20: { on: true, n: 2 } }, 'system.x': 'a', list: [1, { a: 1 }] }))
      .toEqual({ 'flags.essence20.on': true, 'flags.essence20.n': 2, 'system.x': 'a', list: [1, { a: 1 }] });
    expect(flattenPaths(undefined)).toEqual({});
  });

  test('flatRulePaths: every path-keyed field at any depth, `system` only on grant steps, input untouched', () => {
    const rule = {
      type: 'Trigger', when: ['self:morphed'],
      steps: [
        { do: 'updateActor', set: { flags: { essence20: { ninjaPowerActive: true } } }, add: { system: { health: { value: '2' } } } },
        { do: 'roll', onSuccess: [{ do: 'updateItem', set: { system: { active: false } } }] },
        { do: 'grant', system: { hardpoint: { type: 'external' } } },
        { do: 'createItem', data: { type: 'weapon', system: { classification: { style: 'melee' } } } },
        { do: 'addEffect', changes: [{ key: 'system.x', value: 1 }] },
      ],
    };
    const before = JSON.stringify(rule);
    const flat = flatRulePaths(rule);
    expect(JSON.stringify(rule)).toBe(before);
    expect(flat.steps[0].set).toEqual({ 'flags.essence20.ninjaPowerActive': true });
    expect(flat.steps[0].add).toEqual({ 'system.health.value': '2' });
    expect(flat.steps[1].onSuccess[0].set).toEqual({ 'system.active': false });
    expect(flat.steps[2].system).toEqual({ 'hardpoint.type': 'external' });
    expect(flat.steps[3].data.system).toEqual({ classification: { style: 'melee' } });
    expect(flat.steps[4].changes).toEqual([{ key: 'system.x', value: 1 }]);
    expect(PATH_KEYED).toContain('ladder');
  });

  test('every pack rule survives Foundry storage: expanded, then flattened, its path-keyed fields read as authored', () => {
    let checked = 0;
    const packs = join(ROOT, 'packs');
    for (const dir of readdirSync(packs)) {
      const source = join(packs, dir, '_source');
      if (!existsSync(source)) {
        continue;
      }

      for (const file of readdirSync(source).filter(name => name.endsWith('.json'))) {
        const doc = JSON.parse(readFileSync(join(source, file), 'utf8'));
        for (const rule of doc.system?.rules ?? []) {
          // Authored rules spell path-keyed fields flat (no nested objects there), so flattening is a no-op on them...
          expect([doc.name, flatRulePaths(rule)]).toEqual([doc.name, rule]);
          // ...and undoes Foundry's expansion of them exactly.
          expect([doc.name, flatRulePaths(expand(rule))]).toEqual([doc.name, flatRulePaths(rule)]);
          checked++;
        }
      }
    }

    expect(checked).toBeGreaterThan(4000);
  });
});
