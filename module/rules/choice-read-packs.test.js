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
 *
 * Phase 2 (Perk choice P2): the 116 are converted - each asks its pick through rules (a ChoiceSet carrying
 * `legacy: "system.choice"`, or a pickSubPerk) and its own tags read `rule:choiceHas` / `{choice.<key>}`. What is left
 * here: the items that read ANOTHER item's pick (`choiceOf`), against a legacy-only world copy of their (now converted)
 * targets; the inventory; and every converted item's legacy-only copy reading its old pick through its legacy setting.
 * The old-vs-new rule parity of the converted items themselves is rules/perk-choice-p2.test.js (against the pre-conversion
 * pack snapshot in test-data/perk-choice-p2-baseline.json (repo root - kept out of the release zip)).
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

// The 116 old pickers, as they were before the conversion (Perk choice P2), and as they are now in the packs.
const BASELINE = JSON.parse(readFileSync(join(ROOT, 'test-data', 'perk-choice-p2-baseline.json'), 'utf8'));
const BASELINE_PICKERS = Object.keys(BASELINE).filter(id => BASELINE[id].picker);
const LEGACY_PICKERS = ALL.filter(({ doc }) => BASELINE_PICKERS.includes(doc._id));
const READ_FORMS = /\{item\.choice\}|(?:rule|item):data:system\.choice|choiceOf|\{sourced\.[A-Za-z0-9]{16}\.system\.choice/;
const READERS = ALL.filter(({ doc }) => {
  const rules = doc.system?.rules ?? [];
  return READ_FORMS.test(JSON.stringify(rules)) || objectsIn(rules).some(o => o.to == 'choice' || (Array.isArray(o.skills) && o.skills.includes('choice')));
});
const uniq = list => [...new Set(list)];
// How often each form was actually exercised with a pick present (checked at the end, so the harness can't pass empty).
// Phase 2: {item.choice}, data tags on system.choice and {sourced.<id>.system.choice} are gone from the packs (checked
// below), so only choiceOf is left to exercise.
const seen = { choiceOf: 0 };

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

/** What chosenOf reads off a legacy-only copy of a converted item: the raw value, a list ChoiceSet's wrapped. */
function legacyRead(copy, value) {
  const listed = (copy.system.rules ?? []).some(rule => rule.type == 'ChoiceSet' && rule.legacy == 'system.choice' && rule.count !== undefined);
  return listed && value !== undefined && value !== null && value !== '' ? [value] : value;
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
  test('116 items carried the old picker (115 Perks + Augmented); every one is converted (Perk choice P2)', () => {
    expect(BASELINE_PICKERS.length).toBe(116);
    expect(uniq(LEGACY_PICKERS.map(({ doc }) => doc._id)).length).toBe(116);
    expect(ALL.filter(({ doc }) => doc.system?.hasChoice === true).map(({ doc }) => doc.name)).toEqual([]);
    expect(LEGACY_PICKERS.filter(({ doc }) => doc.system.choiceType && doc.system.choiceType != 'none').map(({ doc }) => doc.name)).toEqual([]);
  });

  test('no pack rule reads the old pick any more ({item.choice}, system.choice data tags, {sourced...system.choice}, to: "choice")', () => {
    const OLD = /\{item\.choice\}|(?:rule|item):data:system\.choice|\{sourced\.[A-Za-z0-9]{16}\.system\.choice/;
    const left = ALL.filter(({ doc }) => {
      const rules = doc.system?.rules ?? [];
      return OLD.test(JSON.stringify(rules)) || objectsIn(rules).some(o => o.to == 'choice' || (Array.isArray(o.skills) && o.skills.includes('choice')));
    });
    expect(left.map(({ doc }) => doc.name)).toEqual([]);
  });

  test('family by family, the converted items hold a primary rules pick; the sub-Perk lists ask through pickSubPerk', () => {
    const byFamily = {};
    for (const { doc } of LEGACY_PICKERS) {
      const was = BASELINE[doc._id].system.choiceType;
      const family = was == 'perks' ? 'D' : was == 'damageType' ? 'E' : was == 'skills' ? 'B'
        : ['senses', 'environments', 'movement', 'altModeMovement'].includes(was) ? 'C' : 'A';
      (byFamily[family] ??= []).push(doc);
    }

    expect(Object.fromEntries(Object.entries(byFamily).map(([family, docs]) => [family, uniq(docs.map(doc => doc._id)).length])))
      // (The plan's inventory table said A 28 - its rows add up to 27; 27 + 32 + 10 + 46 + 1 = 116.)
      .toEqual({ A: 27, B: 32, C: 10, D: 46, E: 1 });
    for (const family of ['A', 'B', 'C', 'E']) {
      expect([family, byFamily[family].filter(doc => !primaryChoiceKey(doc)).map(doc => doc.name)]).toEqual([family, []]);
    }

    const subPerk = doc => (doc.system.rules ?? []).some(rule => rule.type == 'Trigger' && rule.event == 'added' && rule.steps?.some(step => step.do == 'pickSubPerk'));
    expect(byFamily.D.filter(doc => !subPerk(doc)).map(doc => doc.name)).toEqual([]);
    // The readers of another item's pick (choiceOf) have none of their own; their targets now do.
    const referenced = READERS.flatMap(({ doc }) => referencedCopies(doc, 'x'));
    expect(READERS.filter(({ doc }) => primaryChoiceKey(doc)).map(({ doc }) => doc.name)).toEqual([]);
    expect(referenced.filter(doc => !primaryChoiceKey(doc)).map(doc => doc.name)).toEqual([]);
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
      // Text with no pick in it reads the same.
      expect([text, interpolate(text, item)]).toEqual([text, oldInterpolate(text, item)]);

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

    // Every choiceOf target (converted - its ChoiceSet carries legacy "system.choice"): the reader's value is the raw
    // field, a list ChoiceSet's wrapped in a one-entry list.
    expect(chosenOf(item)).toBe(item.system.choice);
    for (const copy of actor.items.slice(1)) {
      expect(chosenOf(copy)).toEqual(legacyRead(copy, copy.system.choice));
    }
  });
});

describe('the 116 legacy pickers on their own', () => {
  test.each(uniq(LEGACY_PICKERS.map(({ doc }) => doc._id)).map(id => [byId.get(id).name, id]))('%s (%s): a legacy-only copy reads its stored system.choice', (name, id) => {
    for (const value of ['sample', 'none', '', null, undefined]) {
      const item = copyOf(byId.get(id), value);
      expect(chosenOf(item)).toEqual(legacyRead(item, value));
    }
  });
});

afterAll(() => {
  expect(Object.entries(seen).filter(([, count]) => count == 0)).toEqual([]);
});
