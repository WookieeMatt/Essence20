import { jest } from '@jest/globals';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Phase 0 parity harness (docs/PERK_CHOICE_MIGRATION_PLAN.md §2.1): every shipped pack rule that reads the old Perk
 * pick - `{item.choice}`, `rule:data:system.choice` / `item:data:system.choice`, `choiceOf:<uuid>`, DamageType
 * `to: "choice"`, `{sourced.<id>.system.choice}`, DieSubstitution `skills: ["choice"]` - read against a world copy that
 * carries only a legacy `system.choice`, through the new reader (rules/choice-read.mjs) and through the old one (the
 * raw field). The answers must be identical, for every one of the 116 items with an old picker and every value their
 * own rules test for.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn(), createViaGm: jest.fn() }));

await import('./plugins/index.mjs');
const { rebuildIndex, ruleLabel } = await import('./index.mjs');
const { contextFor, evaluateTag, interpolate } = await import('./predicate.mjs');
const { chosenOf, primaryChoiceKey } = await import('./choice-read.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const getPath = (object, path) => path.split('.').reduce((at, key) => at?.[key], object);

/** Every item document in packs/<pack>/_source (embedded items too), with its pack folder. */
function packItems() {
  const out = [];
  for (const pack of readdirSync(join(ROOT, 'packs'))) {
    const dir = join(ROOT, 'packs', pack, '_source');
    if (!existsSync(dir)) {
      continue;
    }

    for (const file of readdirSync(dir).filter(name => name.endsWith('.json'))) {
      const walk = doc => {
        if (doc?.system && doc.type) {
          out.push({ pack, doc });
        }

        for (const child of doc?.items ?? []) {
          walk(child);
        }
      };

      walk(JSON.parse(readFileSync(join(dir, file), 'utf8')));
    }
  }

  return out;
}

/** Every string anywhere inside a value. */
function stringsIn(value, out = []) {
  if (typeof value == 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    value.forEach(entry => stringsIn(entry, out));
  } else if (value && typeof value == 'object') {
    Object.values(value).forEach(entry => stringsIn(entry, out));
  }

  return out;
}

/** Every object anywhere inside a value (rules and their nested steps). */
function objectsIn(value, out = []) {
  if (Array.isArray(value)) {
    value.forEach(entry => objectsIn(entry, out));
  } else if (value && typeof value == 'object') {
    out.push(value);
    Object.values(value).forEach(entry => objectsIn(entry, out));
  }

  return out;
}

const ALL = packItems();
const byId = new Map();
for (const entry of ALL) {
  if (!byId.has(entry.doc._id)) {
    byId.set(entry.doc._id, entry.doc);
  }
}

const LEGACY_PICKERS = ALL.filter(({ doc }) => doc.system?.hasChoice || doc.system?.choice);
const READ_FORMS = /\{item\.choice\}|(?:rule|item):data:system\.choice|choiceOf|\{sourced\.[A-Za-z0-9]{16}\.system\.choice/;
const READERS = ALL.filter(({ doc }) => {
  const rules = doc.system?.rules ?? [];
  return READ_FORMS.test(JSON.stringify(rules)) || objectsIn(rules).some(o => o.to == 'choice' || (Array.isArray(o.skills) && o.skills.includes('choice')));
});
const uniq = list => [...new Set(list)];
// How often each form was actually exercised with a pick present (checked at the end, so the harness can't pass empty).
const seen = { itemChoice: 0, sourced: 0, dataTag: 0, choiceOf: 0 };

/** The old interpolation: {item.choice} straight off system.choice, {sourced...} straight off the copy. */
function oldInterpolate(text, ruleItem) {
  let missing = false;
  const filled = text.replace(/\{(choice\.[\w-]+|item\.choice|sourced\.[A-Za-z0-9]{16}\.[\w.]+)\}/g, (match, ref) => {
    let value;
    if (ref == 'item.choice') {
      value = ruleItem?.system?.choice;
    } else if (ref.startsWith('sourced.')) {
      const id = ref.slice(8, 24);
      const copy = ruleItem.parent.items.find(item => String(item.flags?.core?.sourceId ?? '').split('.').pop() == id);
      value = copy ? getPath(copy, ref.slice(25)) : undefined;
    } else {
      value = ruleItem?.flags?.essence20?.rules?.choices?.[ref.slice(7)];
    }

    if (value === undefined || value === null || value === '') {
      missing = true;
      return '';
    }

    return String(value);
  });
  return missing ? null : filled;
}

/** A world copy of a pack item holding only a legacy pick. */
function copyOf(doc, choice, sourceUuid = `Compendium.essence20.test.Item.${doc._id}`) {
  return {
    id: `c${doc._id}`, name: doc.name, type: doc.type,
    flags: { core: { sourceId: sourceUuid } },
    system: { ...JSON.parse(JSON.stringify(doc.system)), choice },
  };
}

function actorWith(items) {
  const actor = { id: 'a', uuid: 'Actor.a', name: 'Hero', type: 'playerCharacter', flags: { essence20: {} }, statuses: new Set(), system: { level: 5, skills: {} } };
  actor.items = Object.assign(items, { contents: items, get: id => items.find(item => item.id == id) });
  items.forEach(item => (item.parent = actor));
  actor.getActiveTokens = () => [];
  rebuildIndex(actor);
  return actor;
}

/** The values a reader's own rules test system.choice against, plus a stray one and "no pick". */
function candidateValues(doc) {
  const tested = [...JSON.stringify(doc.system?.rules ?? []).matchAll(/system\.choice!?=([\w-]+)/g)].map(m => m[1]);
  return uniq([...tested, 'sample', 'none', '']);
}

/** Copies of the items a reader points at by `choiceOf:<uuid>` / `choiceOf: <uuid>` / `{sourced.<id>...}`. */
function referencedCopies(doc, choice) {
  const text = JSON.stringify(doc.system?.rules ?? []);
  const uuids = uniq([...text.matchAll(/choiceOf"?:"?(Compendium\.[\w.]+)/g)].map(m => m[1]));
  const sourced = uniq([...text.matchAll(/\{sourced\.([A-Za-z0-9]{16})\./g)].map(m => m[1]));
  return [
    ...uuids.map(uuid => ({ uuid, target: byId.get(uuid.split('.').pop()) })).filter(r => r.target).map(r => copyOf(r.target, choice, r.uuid)),
    ...sourced.map(id => byId.get(id)).filter(Boolean).map(target => copyOf(target, choice, `Compendium.essence20.test.Item.${target._id}`)),
  ];
}

beforeEach(() => {
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] }, actors: { contents: [] },
    settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key, has: () => false },
  };
  global.foundry = { ...global.foundry, utils: { ...(global.foundry?.utils ?? {}), getProperty: getPath, setProperty: () => {} } };
});

describe('pack inventory', () => {
  test('116 items carry the old picker (115 Perks + Augmented); 70+ items read the old pick in their rules', () => {
    expect(uniq(LEGACY_PICKERS.map(({ doc }) => doc._id)).length).toBe(116);
    expect(READERS.length).toBeGreaterThanOrEqual(70);
  });

  test('none of them has a primary rules pick yet, so a legacy copy can only read system.choice (phase 0: no change)', () => {
    const referenced = READERS.flatMap(({ doc }) => referencedCopies(doc, 'x'));
    const withKey = [...LEGACY_PICKERS.map(({ doc }) => doc), ...READERS.map(({ doc }) => doc), ...referenced]
      .filter(doc => primaryChoiceKey(doc))
      .map(doc => doc.name);
    // Phase 2 adds ChoiceSets to these items (and rewrites their tags in the same edit) - this list then grows on purpose.
    expect(uniq(withKey)).toEqual([]);
  });
});

describe.each(uniq(READERS.map(({ doc }) => doc._id)).map(id => [byId.get(id).name, id]))('%s (%s)', (name, id) => {
  const doc = byId.get(id);
  const strings = uniq(stringsIn(doc.system.rules));

  test.each(candidateValues(doc))('system.choice = "%s": interpolation, data tags and choiceOf read identically', value => {
    const item = copyOf(doc, value);
    const actor = actorWith([item, ...referencedCopies(doc, value)]);
    const ctx = contextFor({ self: actor, ruleItem: item, item, rolledSkill: value || undefined });

    for (const text of strings) {
      // {item.choice} / {sourced.<id>.system.choice}: the filled text (or "missing").
      expect([text, interpolate(text, item)]).toEqual([text, oldInterpolate(text, item)]);
      if (value && text.includes('{item.choice}')) {
        seen.itemChoice += interpolate(text, item) === null ? 0 : 1;
      }

      if (value && /\{sourced\.\w+\.system\.choice\}/.test(text)) {
        seen.sourced += interpolate(text, item)?.includes(value) ? 1 : 0;
      }

      // Data tags: the alias against the raw field, renamed so the alias can't apply.
      for (const tag of text.match(/(?:rule|item):data:system\.choice(?:!?=[\w-]*)?/g) ?? []) {
        item.system.rawChoice = item.system.choice;
        expect([tag, evaluateTag(tag, ctx)]).toEqual([tag, evaluateTag(tag.replace('system.choice', 'system.rawChoice'), ctx)]);
        seen.dataTag += evaluateTag(tag, ctx) === true ? 1 : 0;
      }

      // skill:choiceOf:<uuid> - the referenced copy's raw pick against the rolled Skill.
      for (const [, uuid] of text.matchAll(/skill:choiceOf:(Compendium\.[\w.]+)/g)) {
        const copy = actor.items.find(other => other.flags.core.sourceId == uuid);
        const old = ctx.rolledSkill === undefined ? null : !!copy?.system.choice && ctx.rolledSkill == copy.system.choice;
        expect([text, evaluateTag(`skill:choiceOf:${uuid}`, ctx)]).toEqual([text, old]);
        seen.choiceOf += old === true ? 1 : 0;
      }
    }

    // ruleLabel's {item.choice}.
    for (const rule of doc.system.rules) {
      if (rule?.label) {
        const old = String(rule.label).replace(/\{(choice\.[\w-]+|item\.choice)\}/g, (match, ref) => {
          const raw = ref == 'item.choice' ? item.system.choice : undefined;
          return raw === undefined || raw === null || raw === '' ? '…' : String(raw);
        });
        expect(ruleLabel(rule, item)).toBe(old);
      }
    }

    // DamageType to: "choice", DieSubstitution "choice", every choiceOf target: the reader's value is the raw field.
    expect(chosenOf(item)).toBe(item.system.choice);
    for (const copy of actor.items.slice(1)) {
      expect(chosenOf(copy)).toBe(copy.system.choice);
    }
  });
});

describe('the 116 legacy pickers on their own', () => {
  test.each(uniq(LEGACY_PICKERS.map(({ doc }) => doc._id)).map(id => [byId.get(id).name, id]))('%s (%s): chosenOf is the stored system.choice', (name, id) => {
    for (const value of [...candidateValues(byId.get(id)), null, undefined]) {
      const item = copyOf(byId.get(id), value);
      expect(chosenOf(item)).toBe(value);
    }
  });
});

afterAll(() => {
  expect(Object.entries(seen).filter(([, count]) => count == 0)).toEqual([]);
});
