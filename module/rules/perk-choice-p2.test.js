/**
 * Perk choice P2 (docs/PERK_CHOICE_MIGRATION_PLAN.md, "Phase 2 - done"): the 116 old-picker pack items converted onto
 * rules choices, group by group (P2a fixed lists, P2b Skills, P2c picks written into the actor, P2d sub-Perk lists, P2e
 * Augmented and the rule-written picks), and the world migration (migration.mjs#migratePerkChoices).
 *
 *  - conversion parity: for every converted item, the new ChoiceSet offers what the old picker's switch offered for the
 *    same actor, and the item's rules give the same answers for the same pick as its old rules gave with the old
 *    system.choice - against the pre-conversion snapshot in test-data/perk-choice-p2-baseline.json (repo root - kept out of the release zip);
 *  - P2b list-awareness: chat text / labels list every entry, Grant uuids grant every entry, choiceOf Skill readers and
 *    DamageType `to` take the first, dieOf / Reroll scope / tags read every entry;
 *  - the old picker never asks for a converted item (one dialog per pick); pickSubPerk `required`;
 *  - the migration: value-matched copy into empty slots, the unmatched / unpicked reported, the list wrap, the unbake once
 *    (in the same update as its flag), the duplicate-copy fold, unlinked token actors, a second run doing nothing.
 */
import { jest } from '@jest/globals';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

global.Hooks = global.Hooks ?? { on: () => {}, once: () => {}, callAll: () => {} };
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn(), createViaGm: jest.fn() }));

await import('./plugins/index.mjs');
const { rebuildIndex, ruleLabel } = await import('./index.mjs');
const { contextFor, evaluateTag, interpolate } = await import('./predicate.mjs');
const { choiceValue, chosenOf, firstChosen, legacyChoiceRule } = await import('./choice-read.mjs');
const { choiceOptions, grantData, initialState, matchedLegacyChoice } = await import('./lifecycle.mjs');
const { choicePaths, ruleDamageType, ruleDerived, ruleDieSubstitution, ruleRerollGrants } = await import('./adapter.mjs');
const { hasRulesPick, hasSubPerkPick, perkChoiceProblems } = await import('./choice-checks.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { setSubPerkHelpers } = await import('./plugins/picks/pick-sub-perk.mjs');
const migration = await import('../migration.mjs');
const {
  migrateActorPerkChoices, migratePerkChoiceItem, migratePerkChoices, perkChoiceReport,
  perkChoiceReportText, planActorPerkChoices, planPerkCopyFold, resetMigrationCaches, unbakePerkChoice,
} = migration;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASELINE = JSON.parse(readFileSync(join(ROOT, 'test-data', 'perk-choice-p2-baseline.json'), 'utf8'));
const E20 = global.CONFIG.E20;
const clone = value => JSON.parse(JSON.stringify(value));
const getPath = (object, path) => String(path).split('.').reduce((at, key) => (at === null || at === undefined ? at : at[key]), object);
function setPath(object, path, value) {
  const keys = String(path).split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

/** The pack documents, by id (the converted ones as they are now). */
const PACK = new Map();
for (const pack of readdirSync(join(ROOT, 'packs'))) {
  const dir = join(ROOT, 'packs', pack, '_source');
  if (existsSync(dir)) {
    for (const file of readdirSync(dir).filter(name => name.endsWith('.json'))) {
      const doc = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      PACK.set(doc._id, doc);
    }
  }
}

const PICKERS = Object.entries(BASELINE).filter(([, old]) => old.picker).map(([id, old]) => ({ id, old, doc: PACK.get(id) }));
const familyOf = choiceType => (choiceType == 'perks' ? 'D' : choiceType == 'damageType' ? 'E' : choiceType == 'skills' ? 'B'
  : ['senses', 'environments', 'movement', 'altModeMovement'].includes(choiceType) ? 'C' : 'A');

let nextId = 1;

function makeItem(data = {}) {
  const item = {
    id: data.id ?? `i${nextId++}`, name: data.name ?? 'Perk', type: data.type ?? 'perk', flags: data.flags ?? {}, effects: data.effects ?? [],
    _stats: data._stats ?? {}, system: data.system ?? {},
  };
  item.update = jest.fn(async changes => {
    for (const [key, value] of Object.entries(changes)) {
      setPath(item, key, value);
    }
  });
  item.delete = jest.fn(async () => {
    const list = item.parent?.items?.contents;
    if (list?.includes(item)) {
      list.splice(list.indexOf(item), 1);
    }
  });
  return item;
}

function makeActor(items = [], system = {}) {
  const actor = {
    id: `a${nextId++}`, documentName: 'Actor', name: 'Hero', type: 'playerCharacter', isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: {
      level: 5, skills: Object.fromEntries(Object.keys(E20.skills).map(skill => [skill, { shift: 'd4', shiftUp: 0, shiftDown: 0 }])),
      senses: Object.fromEntries(Object.keys(E20.senses).map(sense => [sense, { acute: false }])),
      environments: [],
      movement: Object.fromEntries(Object.keys(E20.movementTypes).map(type => [type, { base: type == 'ground' ? 30 : 0, bonus: 0, altMode: 0, total: type == 'ground' ? 30 : 0 }])),
      resistances: {}, defenses: {},
      ...system,
    },
    getActiveTokens: () => [],
    getFlag: () => undefined,
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = Object.assign(items, { contents: items, get: id => items.find(item => item.id == id) });
  for (const item of items) {
    item.parent = actor;
  }

  actor.update = jest.fn(async data => {
    for (const [key, value] of Object.entries(data)) {
      if (key == 'items') {
        for (const { _id, effects, ...change } of value) {
          const item = actor.items.get(_id);
          for (const [path, v] of Object.entries(change)) {
            setPath(item, path, v);
          }

          for (const { _id: effectId, ...effectChange } of effects ?? []) {
            Object.assign(item.effects.find(effect => effect._id == effectId) ?? {}, effectChange);
          }
        }
      } else {
        setPath(actor, key, value);
      }
    }
  });
  actor.deleteEmbeddedDocuments = jest.fn(async (type, ids) => {
    for (const id of ids) {
      const index = items.findIndex(item => item.id == id);
      if (index >= 0) {
        items.splice(index, 1);
      }
    }
  });
  actor.createEmbeddedDocuments = jest.fn(async () => []);
  return actor;
}

const uuidOf = id => `Compendium.essence20.test.Item.${id}`;

/** A world copy of a pack item: its rules inherited (the prepared system.rules), its own stored data. */
function copyOf(doc, { choice, choices, flags = {}, system = {}, id } = {}) {
  return makeItem({
    id, name: doc.name, type: doc.type,
    flags: { ...flags, core: { sourceId: uuidOf(doc._id) }, essence20: { ...(flags.essence20 ?? {}), ...(choices ? { rules: { choices } } : {}) } },
    system: { ...clone(doc.system), ...(choice !== undefined ? { choice } : {}), ...system },
    effects: clone(doc.effects ?? []),
  });
}

beforeEach(() => {
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] }, actors: [], items: [], scenes: [],
    settings: { get: jest.fn(() => 0), set: jest.fn(async () => {}) },
    i18n: { localize: key => key, format: (key, data) => `${key} ${JSON.stringify(data ?? {})}`, has: () => false },
    packs: { get: () => null },
  };
  global.ui = { notifications: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } };
  global.foundry = { ...(global.foundry ?? {}), utils: { ...(global.foundry?.utils ?? {}), getProperty: getPath, setProperty: setPath, deepClone: clone } };
  resetMigrationCaches();
  setSubPerkHelpers(null);
});

/* -------------------------------------------- */
/*  Inventory: every group converted              */
/* -------------------------------------------- */

describe('the 116 conversions', () => {
  test('each is converted the way its group says, with every pick required, and passes the static checks', () => {
    expect(PICKERS.length).toBe(116);
    for (const { id, old, doc } of PICKERS) {
      const rules = doc.system.rules;
      expect([doc.name, doc.system.hasChoice, perkChoiceProblems(doc)]).toEqual([doc.name, false, []]);
      expect([doc.name, hasRulesPick(doc)]).toEqual([doc.name, true]);
      if (familyOf(old.system.choiceType) == 'D') {
        const step = rules[0].steps[0];
        expect([doc.name, rules[0].event, rules[0].removeOnStop, step.do, step.required]).toEqual([doc.name, 'added', true, 'pickSubPerk', true]);
        expect(hasSubPerkPick(doc)).toBe(true);
      } else {
        const set = rules.find(rule => rule.type == 'ChoiceSet');
        expect([doc.name, set.required, set.legacy]).toEqual([doc.name, true, 'system.choice']);
        expect(legacyChoiceRule(doc, set.key)).toBe(set);
      }

      expect(id).toBe(doc._id);
    }
  });
});

/* -------------------------------------------- */
/*  Conversion parity: the options                */
/* -------------------------------------------- */

/** The old picker's option values for a choiceType (sheet-handlers/perk-handler.mjs#setPerkValues' switch), for this actor. */
const TABLE_OF = {
  airBornMovement: 'airBornMovement', alwaysReadyFunction: 'alwaysReadyOptions', powerAdaptation: 'powerAdaptationOptions',
  electromagneticDisruption: 'electromagneticDisruptionOptions', defensiveFlexibility: 'defensiveFlexibilityOptions',
  energyConnectionOption: 'energyConnectionOptions', viciousOrVenom: 'viciousOrVenomOptions', toothAndClaw: 'toothAndClawOptions',
  overTheCandlestick: 'overTheCandlestickOptions', sparedNoExpenseSkill: 'sparedNoExpenseSkills', communityHelperSkill: 'communityHelperSkills',
  roamingTheLand: 'roamingTheLandOptions', twoHandedAssault: 'twoHandedAssaultOptions', elementDamageType: 'elementDamageTypes',
  stoneWarlordDamageType: 'stoneWarlordDamageTypes', wisdomOfTheElders: 'wisdomOfTheEldersOptions', phantomFocus: 'phantomFocusOptions',
  experiment: 'experimentOptions', fightingStyle: 'fightingStyle',
};

function oldOptions(old, actor, chosenElsewhere = []) {
  const s = old.system;
  switch (s.choiceType) {
  case 'field': return [...E20.fieldSkills];
  case 'environments': return Object.keys(E20.environments).filter(env => !actor.system.environments.includes(env));
  case 'movement': return Object.keys(actor.system.movement).filter(type => actor.system.movement[type].base > 0);
  case 'altModeMovement': case 'vehicleType': return ['aerial', 'ground', 'swim'];
  case 'senses': return Object.keys(E20.senses).filter(sense => !actor.system.senses[sense].acute);
  case 'skills': return Object.keys(E20.skills).filter(skill => !chosenElsewhere.includes(skill) && (!s.choiceEssence || E20.skillToEssence[skill] == s.choiceEssence));
  case 'essence': return Object.keys(E20.essences).filter(essence => essence != 'any');
  case 'damageType': return Object.keys(E20.damageTypes);
  default: return Object.keys(E20[TABLE_OF[s.choiceType]]);
  }
}

describe('conversion parity: the same options as the old picker', () => {
  const NOT_D = PICKERS.filter(({ old }) => familyOf(old.system.choiceType) != 'D');
  // Book check (docs/PERK_CHOICE_MIGRATION_PLAN.md "Phase 2 - done"): All-Terrain Alt Mode offers every Movement type
  // (TF CRB 2nd printing p.110 - "a Movement Type you do not have access to"); the old picker offered three.
  const BOOK_WIDER = { f7QOaDUFo1b0184W: Object.keys(E20.movementTypes) };

  test.each(NOT_D.map(({ id, doc }) => [doc.name, id]))('%s (%s)', (name, id) => {
    const { old, doc } = PICKERS.find(entry => entry.id == id);
    // An actor holding some of each source, so notHeld / held are exercised.
    const actor = makeActor([], {
      senses: { ...makeActor().system.senses, hearing: { acute: true } },
      environments: ['arctic', 'urban'],
      movement: { ...makeActor().system.movement, swim: { base: 10, bonus: 0, altMode: 0, total: 10 } },
    });
    const item = copyOf(doc);
    actor.items.push(item);
    item.parent = actor;
    const set = doc.system.rules.find(rule => rule.type == 'ChoiceSet');
    const now = choiceOptions(set, { actor, item });
    expect(now.map(option => option.value).sort()).toEqual([...(BOOK_WIDER[id] ?? oldOptions(old, actor))].sort());
    // Labels: the same localized table text the old picker showed.
    for (const option of now) {
      expect(option.label).toBeTruthy();
    }
  });

  test('family D: the sub-Perk list is the item\'s own system.items, as the old picker offered (Nobody Like Me: any General Perk)', () => {
    for (const { old, doc } of PICKERS.filter(({ old: entry }) => familyOf(entry.system.choiceType) == 'D')) {
      expect([doc.name, Object.values(doc.system.items ?? {}).map(entry => entry.uuid).sort()])
        .toEqual([doc.name, Object.values(old.system.items).map(entry => entry.uuid).sort()]);
      const step = doc.system.rules[0].steps[0];
      const n = old.system.numChoices || 1;
      const was = doc._id == 'eaYIHKLGRUxj4QGv' ? 2 : n;
      expect([doc.name, String(step.count ?? 1).split(' ')[0]]).toEqual([doc.name, String(was)]);
      expect([doc.name, !!step.anyGeneral]).toEqual([doc.name, (old.system.rules ?? []).some(rule => rule.type == 'AnyGeneralPerkChoice')]);
    }
  });

  test('counts: the multi-Skill Perks hold a list (GI Joe Expertise 2, I\'ve Done My Research 3 Smarts, Low Tech Priorities 2); Environment Choice 2 (book)', () => {
    const set = id => PACK.get(id).system.rules[0];
    expect([set('F9kOLys1Iu4UOg22').count, set('F9kOLys1Iu4UOg22').excludeCopies]).toEqual([2, true]);
    expect([set('JE59xgHb7NxEV9AZ').count, set('JE59xgHb7NxEV9AZ').essence]).toEqual([3, 'smarts']);
    expect(set('khD9UfuqUQ4rWSUP').count).toBe(2);
    // GI Joe CRB p.92: "Choose two additional environments" - the old picker asked for one.
    expect(set('eaYIHKLGRUxj4QGv').count).toBe(2);
  });
});

/* -------------------------------------------- */
/*  Conversion parity: the rules' answers          */
/* -------------------------------------------- */

/** Every string in a value, with its path. */
function stringsAt(value, path = '', out = []) {
  if (typeof value == 'string') {
    out.push([path, value]);
  } else if (Array.isArray(value)) {
    value.forEach((entry, i) => stringsAt(entry, `${path}[${i}]`, out));
  } else if (value && typeof value == 'object') {
    for (const [key, entry] of Object.entries(value)) {
      stringsAt(entry, path ? `${path}.${key}` : key, out);
    }
  }

  return out;
}

const blank = value => (value === undefined || value === null || value === '' ? null : value);

/** The old rules lined up with the new ones: the added pick rules and the retired picker rules left out. */
function alignedRules(old, doc) {
  const oldRules = (old.system.rules ?? []).filter(rule => !['UniqueChoice', 'AnyGeneralPerkChoice'].includes(rule?.type));
  const added = doc.system.rules.length - oldRules.length;
  return oldRules.map((rule, i) => [rule, doc.system.rules[added + i]]);
}

/** The values an item's old rules tested for, plus its options' first few and two strays. */
function candidates(old, doc) {
  const tested = [...JSON.stringify(old.system.rules ?? []).matchAll(/system\.choice!?=([\w-]+)/g)].map(m => m[1]);
  const set = doc.system.rules.find(rule => rule.type == 'ChoiceSet');
  const options = set ? choiceOptions(set, { actor: makeActor(), item: copyOf(doc), allOptions: true }).map(option => option.value) : [];
  return [...new Set([...tested, ...options.slice(0, 4), 'none'])];
}

const seenParity = { tags: 0, trueTags: 0, texts: 0 };

describe('conversion parity: the same answers for the same pick (old rules + old system.choice vs new rules + the rules choice)', () => {
  const CONVERTED = PICKERS.filter(({ old }) => familyOf(old.system.choiceType) != 'D' && (old.system.rules ?? []).length);

  test.each(CONVERTED.map(({ id, doc }) => [doc.name, id]))('%s (%s)', (name, id) => {
    const { old, doc } = PICKERS.find(entry => entry.id == id);
    const set = doc.system.rules.find(rule => rule.type == 'ChoiceSet');
    const listed = set.count !== undefined;
    for (const value of candidates(old, doc)) {
      const known = choiceOptions(set, { actor: makeActor(), item: copyOf(doc), allOptions: true }).some(option => option.value == value);
      // Old: the old rules, the pick in system.choice (the Details cleanup's flag set: the bonus is the rule's, not baked).
      const before = makeItem({ name: doc.name, flags: { core: { sourceId: uuidOf(id) }, essence20: { perkValueRule: true } }, system: { rules: clone(old.system.rules), choice: value, value: 0 } });
      // New, migrated: the new rules, the pick in the rules choice. New, not yet migrated: the old pick through `legacy`.
      const migrated = copyOf(doc, { choices: known ? { [set.key]: listed ? [value] : value } : {}, system: { choice: known ? null : value, value: 0 } });
      const unmigrated = copyOf(doc, { choice: value, system: { value: 0 } });
      for (const after of [migrated, unmigrated]) {
        makeActor([before]);
        makeActor([after]);
        const weapon = { type: 'weaponEffect', system: { damageType: value, classification: { style: 'melee' } }, flags: {} };
        const ctx = item => contextFor({ self: item.parent, ruleItem: item, item: weapon, rolledSkill: value, rolledEssence: value });
        for (const [oldRule, newRule] of alignedRules(old, doc)) {
          const newStrings = new Map(stringsAt(newRule));
          for (const [path, oldText] of stringsAt(oldRule)) {
            const newText = newStrings.get(path);
            if (newText === undefined || newText === oldText && !oldText.includes('{')) {
              continue;
            }

            if (oldText == 'choice' && newText.startsWith('{choice.')) {
              // DamageType to / DieSubstitution skills: the old reader's value against the new pick.
              expect([name, value, path, blank(firstChosen(chosenOf(before)))]).toEqual([name, value, path, blank(choicePaths(newText, after)[0])]);
            } else if (/^[\w!-]+:/.test(oldText) && /(^|\.)(when|filter|appliesWhen|check)\b/.test(path)) {
              const a = evaluateTag(oldText, ctx(before));
              const b = evaluateTag(newText, ctx(after));
              expect([name, value, path, oldText, a]).toEqual([name, value, path, oldText, b]);
              seenParity.tags++;
              seenParity.trueTags += a === true ? 1 : 0;
            } else if (oldText.includes('{')) {
              expect([name, value, path, choicePaths(oldText, before)]).toEqual([name, value, path, choicePaths(newText, after)]);
              expect([name, value, path, ruleLabel({ label: oldText }, before)]).toEqual([name, value, path, ruleLabel({ label: newText }, after)]);
              seenParity.texts++;
            }
          }
        }
      }
    }
  });

  afterAll(() => {
    expect(seenParity.tags).toBeGreaterThan(300);
    expect(seenParity.trueTags).toBeGreaterThan(50);
    expect(seenParity.texts).toBeGreaterThan(30);
  });
});

/* -------------------------------------------- */
/*  P2c: picks the old picker wrote into the actor  */
/* -------------------------------------------- */

describe('P2c: senses, environments, alt-mode movement derived from the rules', () => {
  const doc = id => PACK.get(id);

  test.each(['WvjGJ5AcC0z07d0J', 'xhNYPiLSmYWov9CG', 'rl8hs6ezb6VSDahM', 'qKoTBo1FKzCq1qTt'])('Acute Sense %s: the picked sense is acute, as the old stored flag was', id => {
    const actor = makeActor([copyOf(doc(id), { choices: { sense: 'smell' } })]);
    rebuildIndex(actor);
    ruleDerived(actor);
    expect(actor.system.senses.smell.acute).toBe(true);
    expect(actor.system.senses.sight.acute).toBe(false);
  });

  test('Environmental Expertise / Environment Choice: the picks join the environments list, each once', () => {
    const actor = makeActor([
      copyOf(doc('EbbSUA2vSHyv3MjQ'), { choices: { environment: 'desert' } }),
      copyOf(doc('eaYIHKLGRUxj4QGv'), { choices: { environment: ['sea', 'urban'] } }),
    ], { environments: ['urban'] });
    rebuildIndex(actor);
    ruleDerived(actor);
    expect([...actor.system.environments].sort()).toEqual(['desert', 'sea', 'urban']);
  });

  test('All-Terrain Alt Mode: the picked type\'s Alt Mode Movement is 20 (what the bundled Active Effect overrode it to); no AE left in the pack', () => {
    const actor = makeActor([copyOf(doc('f7QOaDUFo1b0184W'), { choices: { movement: 'swim' } })]);
    rebuildIndex(actor);
    ruleDerived(actor);
    expect(actor.system.movement.swim.altMode).toBe(20);
    expect(actor.system.movement.aerial.altMode).toBe(0);
    expect(doc('f7QOaDUFo1b0184W').effects).toEqual([]);
    expect(BASELINE.f7QOaDUFo1b0184W.effects.map(effect => [effect.changes[0].key, effect.changes[0].mode, effect.changes[0].value]))
      .toEqual([['system.movement.ground.altMode', 5, '20'], ['system.movement.aerial.altMode', 5, '20'], ['system.movement.swim.altMode', 5, '20']]);
  });

  test('GI Joe Expertise: up 2 on every listed Skill; a copy still holding its baked value adds nothing', () => {
    const actor = makeActor([
      copyOf(doc('F9kOLys1Iu4UOg22'), { choices: { skill: ['athletics', 'brawn'] } }),
      copyOf(doc('F9kOLys1Iu4UOg22'), { choice: 'might', system: { value: 2 } }),
    ]);
    rebuildIndex(actor);
    ruleDerived(actor);
    expect([actor.system.skills.athletics.shiftUp, actor.system.skills.brawn.shiftUp, actor.system.skills.might.shiftUp]).toEqual([2, 2, 0]);
  });
});

/* -------------------------------------------- */
/*  P2b: list picks read by the single readers      */
/* -------------------------------------------- */

describe('P2b: list picks', () => {
  const listItem = (rules, choices) => makeItem({ name: 'Lister', flags: { core: { sourceId: uuidOf('lister0000000000') }, essence20: { rules: { choices } } }, system: { rules } });
  const SET = { type: 'ChoiceSet', key: 'skill', from: 'skill', count: 2 };

  test('chat text and labels: every entry, joined; nothing picked: missing / "…"', () => {
    const item = listItem([SET], { skill: ['athletics', 'brawn'] });
    expect(interpolate('Picked {choice.skill}.', item)).toBe('Picked athletics, brawn.');
    expect(ruleLabel({ label: 'Studying {choice.skill}' }, item)).toBe('Studying athletics, brawn');
    const none = listItem([SET], { skill: [] });
    expect(interpolate('Picked {choice.skill}.', none)).toBeNull();
    expect(ruleLabel({ label: 'Studying {choice.skill}' }, none)).toBe('Studying …');
  });

  test('Grant uuid "{choice.x}" with a list: every entry granted; a single pick as before', async () => {
    const item = listItem([{ type: 'ChoiceSet', key: 'perks', from: 'list', count: 2, options: ['A', 'B'] }, { type: 'Grant', uuid: '{choice.perks}' }], { perks: ['Compendium.x.y.Item.a', 'Compendium.x.y.Item.b'] });
    const actor = makeActor([item]);
    const load = async uuid => ({ toObject: () => ({ _id: 'zz', name: uuid }) });
    const made = await grantData(item, actor, { load });
    expect(made.map(data => data.name)).toEqual(['Compendium.x.y.Item.a', 'Compendium.x.y.Item.b']);
    item.flags.essence20.rules.choices.perks = 'Compendium.x.y.Item.c';
    expect((await grantData(item, actor, { load })).map(data => data.name)).toEqual(['Compendium.x.y.Item.c']);
  });

  test('choiceOf Skill readers and DamageType `to`: the first entry; dieOf and the Reroll scope: every entry', () => {
    const item = listItem([
      SET,
      { type: 'DamageType', to: 'choice', label: 'x' },
      { type: 'DieSubstitution', label: 'best', mode: 'best', skills: ['{choice.skill}'] },
      { type: 'Reroll', mode: 'ones', target: 'skillDice', reset: 'none', maxUses: 0, skills: ['{choice.skill}'] },
    ], { skill: ['athletics', 'brawn'] });
    const actor = makeActor([item]);
    actor.system.skills.brawn.shift = 'd8';
    rebuildIndex(actor);
    expect(ruleDamageType(actor, null, {})).toBe('athletics');
    // best of every listed Skill's die: brawn's d8 beats athletics' d4.
    expect(ruleDieSubstitution(actor, null, { rolledSkill: 'might' }, 'd2').shift).toBe('d8');
    const reroll = ruleRerollGrants(actor).find(config => config.mode == 'ones');
    expect(reroll.skills).toEqual(['athletics', 'brawn']);
    item.flags.essence20.rules.choices.skill = [];
    rebuildIndex(actor);
    expect(ruleRerollGrants(actor).find(config => config.mode == 'ones')).toBeUndefined();
  });

  test('skill:choiceOf on a list: any entry; DialogSwitch useSkill "choiceOf:" rolls the first entry', async () => {
    const { ruleDialogSwitches } = await import('./adapter.mjs');
    const target = listItem([SET], { skill: ['culture', 'science'] });
    const swap = makeItem({ name: 'Swap', system: { rules: [{ type: 'DialogSwitch', label: 'Roll it instead', useSkill: `choiceOf:${uuidOf('lister0000000000')}`, when: ['skill:intimidation'] }] } });
    const actor = makeActor([target, swap]);
    rebuildIndex(actor);
    for (const rolledSkill of ['culture', 'science']) {
      expect(evaluateTag(`skill:choiceOf:${uuidOf('lister0000000000')}`, contextFor({ self: actor, ruleItem: swap, rolledSkill }))).toBe(true);
    }

    expect(evaluateTag(`skill:choiceOf:${uuidOf('lister0000000000')}`, contextFor({ self: actor, ruleItem: swap, rolledSkill: 'might' }))).toBe(false);
    // Offered on an Intimidation roll; on a Culture roll it would swap Culture for itself - skipped: the first entry is the one.
    expect(ruleDialogSwitches(actor, { rolledSkill: 'intimidation' }).map(entry => entry.label)).toContain('Roll it instead');
    swap.system.rules[0].when = [{ any: ['skill:intimidation', 'skill:culture', 'skill:science'] }];
    rebuildIndex(actor);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'culture' }).map(entry => entry.label)).not.toContain('Roll it instead');
    expect(ruleDialogSwitches(actor, { rolledSkill: 'science' }).map(entry => entry.label)).toContain('Roll it instead');
  });
});

/* -------------------------------------------- */
/*  The pick read before / after the migration       */
/* -------------------------------------------- */

describe('choiceValue: a converted item reads its old pick until migrated', () => {
  const set = { type: 'ChoiceSet', key: 'style', from: 'config', table: 'fightingStyle', legacy: 'system.choice' };

  test('the rules choice first; else the old system.choice (or the 6.1 flag) through `legacy`; a list ChoiceSet wraps it', () => {
    expect(choiceValue({ system: { rules: [set], choice: 'akimbo' }, flags: {} }, 'style')).toBe('akimbo');
    expect(choiceValue({ system: { rules: [set], choice: 'akimbo' }, flags: { essence20: { rules: { choices: { style: 'careful' } } } } }, 'style')).toBe('careful');
    expect(choiceValue({ system: { rules: [set] }, flags: { essence20: { legacyChoice: 'defense' } } }, 'style')).toBe('defense');
    expect(choiceValue({ system: { rules: [{ ...set, count: 2 }], choice: 'akimbo' }, flags: {} }, 'style')).toEqual(['akimbo']);
    // Without `legacy` the old field isn't read.
    expect(choiceValue({ system: { rules: [{ ...set, legacy: undefined }], choice: 'akimbo' }, flags: {} }, 'style')).toBeUndefined();
    // A pick step carrying it (Favorite Weapon's weapon).
    expect(choiceValue({ system: { rules: [{ type: 'Use', steps: [{ do: 'pick', key: 'weapon', legacy: 'system.choice' }] }], choice: 'w1' }, flags: {} }, 'weapon')).toBe('w1');
  });

  test('rule:choiceHas (with a value, or bare: some pick) and item:choiceHas (Gallantry) read it', () => {
    const item = makeItem({ system: { rules: [set], choice: 'triggerHappy' } });
    const actor = makeActor([item]);
    const ctx = contextFor({ self: actor, ruleItem: item, item });
    expect(evaluateTag('rule:choiceHas:style:triggerHappy', ctx)).toBe(true);
    expect(evaluateTag('rule:choiceHas:style:akimbo', ctx)).toBe(false);
    expect(evaluateTag('rule:choiceHas:style', ctx)).toBe(true);
    expect(evaluateTag('item:choiceHas:style:triggerHappy', ctx)).toBe(true);
    item.system.choice = null;
    expect(evaluateTag('rule:choiceHas:style', ctx)).toBe(false);
  });

  test('{sourced.<id>.flags.essence20.rules.choices.<key>}: the copy\'s pick (Self-Preservation), and the step text\'s "|default" (Volatile Delivery)', async () => {
    const affinity = makeItem({ flags: { core: { sourceId: 'Compendium.essence20.decepticon_directive.Item.DgFY0ZmAtClAobiA' } }, system: { rules: [{ type: 'ChoiceSet', key: 'element', from: 'element', legacy: 'system.choice' }], choice: 'cold' } });
    const holder = makeItem({ system: { rules: [] } });
    const actor = makeActor([holder, affinity]);
    expect(interpolate('{sourced.DgFY0ZmAtClAobiA.flags.essence20.rules.choices.element}', holder)).toBe('cold');
    affinity.flags.essence20 = { rules: { choices: { element: 'fire' } } };
    expect(interpolate('{sourced.DgFY0ZmAtClAobiA.flags.essence20.rules.choices.element}', holder)).toBe('fire');
    expect(actor.items.length).toBe(2);
  });

  test('a copy carrying a matched old pick takes it when added (no ask); an unmatched one is asked', async () => {
    const ask = jest.fn(async () => 'careful');
    const carried = makeItem({ system: { rules: [{ ...set, rename: true }], choice: 'akimbo' } });
    const actor = makeActor([carried]);
    expect(matchedLegacyChoice(set, carried, actor)).toBe('akimbo');
    expect(await initialState(carried, actor, { ask })).toMatchObject({ 'flags.essence20.rules.choices.style': 'akimbo' });
    expect(ask).not.toHaveBeenCalled();
    const stray = makeItem({ system: { rules: [set], choice: 'bogus' } });
    makeActor([stray]);
    expect(matchedLegacyChoice(set, stray)).toBeNull();
    expect(await initialState(stray, stray.parent, { ask })).toMatchObject({ 'flags.essence20.rules.choices.style': 'careful' });
  });
});

/* -------------------------------------------- */
/*  One dialog per pick                            */
/* -------------------------------------------- */

describe('the old picker never also asks for a converted item', () => {
  test('setPerkValues: a converted Perk (even a world copy still saying hasChoice) goes straight to the drop; its rules ask', async () => {
    const { setPerkValues } = await import('../sheet-handlers/perk-handler.mjs');
    const doc = PACK.get('2LtDCHxgg9bMvWQK');
    const created = copyOf(doc);
    const dropFunc = jest.fn(async () => [created]);
    const actor = makeActor([]);
    const perk = { ...copyOf(doc, { choice: 'akimbo', system: { hasChoice: true, choiceType: 'fightingStyle' } }), uuid: uuidOf(doc._id) };
    perk.system.advances = { canAdvance: false };
    created.system.advances = { canAdvance: false };
    await setPerkValues(actor, perk, null, dropFunc);
    expect(dropFunc).toHaveBeenCalledTimes(1);
    expect(created.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.choice': expect.anything() }));
  });

  test('grantPerkEquipmentMap: a pickSubPerk Perk\'s list is its options, not a grant', async () => {
    const { grantPerkEquipmentMap } = await import('../sheet-handlers/perk-handler.mjs');
    global.Item = { create: jest.fn() };
    global.fromUuid = jest.fn();
    const grid = PACK.get('R7HF3aSR3ZPURh1W');
    await grantPerkEquipmentMap(makeActor(), copyOf(grid));
    expect(global.Item.create).not.toHaveBeenCalled();
    expect(global.fromUuid).not.toHaveBeenCalled();
  });

  test('onPerkDelete: a copy the migration unbaked has nothing left to take off', async () => {
    const { onPerkDelete } = await import('../sheet-handlers/perk-handler.mjs');
    const actor = makeActor([], { senses: { ...makeActor().system.senses, smell: { acute: true } } });
    const perk = copyOf(PACK.get('WvjGJ5AcC0z07d0J'), { choice: 'smell', system: { choiceType: 'senses' }, flags: { essence20: { choiceMigration: { unbaked: true } } } });
    perk.flags.core = {};
    perk._stats = {};
    await onPerkDelete(actor, perk);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test('Augmented (Hang-Up): its old prompt is skipped once it asks through a ChoiceSet', async () => {
    const { applyHangUpChoice } = await import('../mechanics/characters/hang-up-choice.mjs');
    const hangUp = copyOf(PACK.get('k76uXWWDpe0yKEcu'), { system: { hasChoice: true, choiceType: 'damageType' } });
    global.foundry.applications = { api: { DialogV2: { wait: jest.fn() } } };
    await applyHangUpChoice(hangUp);
    expect(global.foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });
});

describe('pickSubPerk required (user ruling 2026-10-07)', () => {
  const STEP = { do: 'pickSubPerk', key: 'perks', required: true };
  const entries = { a: { uuid: 'Compendium.x.y.Item.a', name: 'A', type: 'perk' }, b: { uuid: 'Compendium.x.y.Item.b', name: 'B', type: 'perk' } };
  const run = async (item, answers) => {
    const ask = jest.fn(async () => answers.shift() ?? null);
    const create = jest.fn(async () => 'key');
    setSubPerkHelpers({ ask, create, gameLine: async () => null, general: async () => ({}) });
    const result = await runSteps([STEP], stepContext({ actor: item.parent, item, targets: [] }));
    return { result, ask, create };
  };

  test('a dropped item: a cancel stops the run (its Trigger\'s removeOnStop takes it off)', async () => {
    const item = makeItem({ system: { items: clone(entries), rules: [] } });
    makeActor([item]);
    const { result, create } = await run(item, [null]);
    expect(result).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  test('a granted item: a cancel asks again until picked; nothing to offer keeps it unpicked', async () => {
    const item = makeItem({ flags: { essence20: { parentId: 'role1' } }, system: { items: clone(entries), rules: [] } });
    makeActor([item]);
    const { result, ask, create } = await run(item, [null, null, 'Compendium.x.y.Item.b']);
    expect(result).not.toBe(false);
    expect(ask).toHaveBeenCalledTimes(3);
    expect(create).toHaveBeenCalledWith(item.parent, item, 'Compendium.x.y.Item.b');
    expect(global.ui.notifications.warn).toHaveBeenCalled();
    const empty = makeItem({ flags: { essence20: { grantedBy: 'x' } }, system: { items: {}, rules: [] } });
    makeActor([empty]);
    expect((await run(empty, [])).result).not.toBe(false);
  });
});

/* -------------------------------------------- */
/*  The world migration                            */
/* -------------------------------------------- */

describe('migration M1: the old pick copied into the rules choice', () => {
  const style = PACK.get('2LtDCHxgg9bMvWQK');
  const research = PACK.get('JE59xgHb7NxEV9AZ');

  test('value-matched into an empty slot; hasChoice back to its default; system.choice kept as the backup', async () => {
    const item = copyOf(style, { choice: 'akimbo', system: { hasChoice: true, choiceType: 'fightingStyle' } });
    const report = perkChoiceReport();
    const update = await migratePerkChoiceItem(item, makeActor([item]), { report });
    expect(update).toEqual({ 'flags.essence20.rules.choices.style': 'akimbo', 'system.hasChoice': false, 'flags.essence20.choiceMigration.copied': true });
    expect(report.copied).toHaveLength(1);
  });

  test('an unmatched value is left alone and reported; nothing picked is reported; a made pick is never overwritten', async () => {
    const report = perkChoiceReport();
    const stray = copyOf(style, { choice: 'kungFu', system: { hasChoice: true } });
    expect(await migratePerkChoiceItem(stray, makeActor([stray]), { report })).toEqual({});
    expect(report.unmatched).toEqual([expect.objectContaining({ item: style.name, value: 'kungFu' })]);
    const empty = copyOf(style, { choice: null });
    expect(await migratePerkChoiceItem(empty, makeActor([empty]), { report })).toEqual({});
    expect(report.unpicked).toHaveLength(1);
    const made = copyOf(style, { choice: 'akimbo', choices: { style: 'careful' } });
    expect(await migratePerkChoiceItem(made, makeActor([made]), { report })).toEqual({});
    expect(perkChoiceReportText(report).lines).toHaveLength(2);
  });

  test('a list ChoiceSet gets a one-entry list; a Skill that isn\'t one of its Essence\'s is unmatched', async () => {
    const item = copyOf(research, { choice: 'science' });
    expect(await migratePerkChoiceItem(item, makeActor([item]))).toMatchObject({ 'flags.essence20.rules.choices.skill': ['science'] });
    const wrong = copyOf(research, { choice: 'athletics' });
    expect(await migratePerkChoiceItem(wrong, makeActor([wrong]))).toEqual({});
  });

  test('a second run does nothing', async () => {
    const item = copyOf(style, { choice: 'akimbo', system: { hasChoice: true } });
    const actor = makeActor([item]);
    await item.update(await migratePerkChoiceItem(item, actor));
    expect(await migratePerkChoiceItem(item, actor)).toEqual({});
  });

  test('Favorite Weapon / Mode Attachment: an owned weapon id (or a uuid of it), Bot Mode or an owned Alt Mode', async () => {
    const weapon = makeItem({ type: 'weapon' });
    const favorite = copyOf(PACK.get('emaXxo2XzoHMoNCe'), { choice: `Actor.x.Item.${weapon.id}` });
    makeActor([weapon, favorite]);
    // A uuid isn't an id: unmatched, left as it is (favoriteWeaponOf still reads its last part).
    expect(await migratePerkChoiceItem(favorite, favorite.parent)).toEqual({});
    favorite.system.choice = weapon.id;
    expect(await migratePerkChoiceItem(favorite, favorite.parent)).toMatchObject({ 'flags.essence20.rules.choices.weapon': weapon.id });
    const mode = copyOf(PACK.get('SgofEgBVvg4josSR'), { choice: 'botMode' });
    makeActor([mode]);
    expect(await migratePerkChoiceItem(mode, mode.parent)).toMatchObject({ 'flags.essence20.rules.choices.mode': 'botMode' });
  });

  test('family D: the children already made under the copy are recorded under its key', async () => {
    const grid = copyOf(PACK.get('R7HF3aSR3ZPURh1W'), { system: { hasChoice: true, choiceType: 'perks' } });
    const childA = makeItem({ flags: { core: { sourceId: 'Compendium.essence20.pr_crb.Item.childAaaaaaaaaaa' }, essence20: { parentId: grid.id } } });
    const childB = makeItem({ flags: { core: { sourceId: 'Compendium.essence20.pr_crb.Item.childBbbbbbbbbbb' }, essence20: { parentId: grid.id } } });
    const actor = makeActor([grid, childA, childB]);
    expect(await migratePerkChoiceItem(grid, actor)).toEqual({
      'flags.essence20.rules.choices.perks': ['Compendium.essence20.pr_crb.Item.childAaaaaaaaaaa', 'Compendium.essence20.pr_crb.Item.childBbbbbbbbbbb'],
      'system.hasChoice': false, 'flags.essence20.choiceMigration.copied': true,
    });
  });

  test('migrateItemData: a world item\'s copy (no actor); an embedded one is left to migrateActorData', async () => {
    const item = { ...clone(style), _id: 'w1', flags: { core: { sourceId: uuidOf(style._id) } }, system: { ...clone(style.system), choice: 'longShot' } };
    expect(await migration.migrateItemData(item)).toMatchObject({ 'flags.essence20.rules.choices.style': 'longShot' });
    expect(await migration.migrateItemData(item, makeActor())).not.toHaveProperty('flags.essence20.rules.choices.style');
  });
});

describe('migration M2: what the old picker baked into the actor comes off once', () => {
  const acute = PACK.get('WvjGJ5AcC0z07d0J');
  const env = PACK.get('EbbSUA2vSHyv3MjQ');
  const terrain = PACK.get('f7QOaDUFo1b0184W');

  test('acute sense / environment / the enabled Alt Mode AE: undone with the flag in ONE actor update; the derived value is the same', async () => {
    const sense = copyOf(acute, { choice: 'smell', system: { choiceType: 'senses', hasChoice: true } });
    const place = copyOf(env, { choice: 'desert', system: { choiceType: 'environments', hasChoice: true } });
    const alt = copyOf(terrain, { choice: 'aerial', system: { choiceType: 'altModeMovement', hasChoice: true } });
    alt.effects = clone(BASELINE.f7QOaDUFo1b0184W.effects).map(effect => ({ ...effect, disabled: !effect.changes[0].key.includes('aerial') }));
    const actor = makeActor([sense, place, alt], {
      senses: { ...makeActor().system.senses, smell: { acute: true } }, environments: ['urban', 'desert'],
    });
    const report = await migrateActorPerkChoices(actor);
    expect(actor.update).toHaveBeenCalledTimes(1);
    const [data] = actor.update.mock.calls[0];
    expect(data).toMatchObject({ 'system.senses.smell.acute': false, 'system.environments': ['urban'] });
    expect(data.items.find(update => update._id == sense.id)).toMatchObject({ 'flags.essence20.choiceMigration.unbaked': true, 'flags.essence20.rules.choices.sense': 'smell' });
    expect(data.items.find(update => update._id == alt.id).effects).toEqual([{ _id: 'UEepQb0ndL3eC8G6', disabled: true }]);
    expect(report.unbaked).toHaveLength(3);
    // The rules give the same back.
    rebuildIndex(actor);
    ruleDerived(actor);
    expect([actor.system.senses.smell.acute, actor.system.environments.includes('desert'), actor.system.movement.aerial.altMode]).toEqual([true, true, 20]);
    // A second run: nothing.
    actor.update.mockClear();
    await migrateActorPerkChoices(actor);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test('a value the player already took off by hand: nothing to undo, reported, flagged', () => {
    const sense = copyOf(acute, { choice: 'smell', system: { choiceType: 'senses' } });
    const actor = makeActor([sense]);
    const report = perkChoiceReport();
    const result = unbakePerkChoice(sense, actor, { system: actor.system }, { report, rules: acute.system.rules });
    expect(result).toEqual({ actorUpdate: {}, itemUpdate: { 'flags.essence20.choiceMigration.unbaked': true } });
    expect(report.clamped).toHaveLength(1);
  });

  test('an unconverted copy (its book item still on the old picker) is never unbaked', () => {
    const sense = copyOf(acute, { choice: 'smell', system: { choiceType: 'senses', rules: [] } });
    const actor = makeActor([sense], { senses: { ...makeActor().system.senses, smell: { acute: true } } });
    expect(unbakePerkChoice(sense, actor, { system: actor.system }, { rules: [] })).toEqual({ actorUpdate: {}, itemUpdate: {} });
  });

  test('Fast / GI Joe Expertise: the Details cleanup\'s migratePerkValue does it (reused), once', async () => {
    const fast = copyOf(PACK.get('DM3png00SY9CgkMN'), { choice: 'ground', system: { choiceType: 'movement', value: 10 } });
    const actor = makeActor([fast]);
    actor.system.movement.ground.bonus = 10;
    await migrateActorPerkChoices(actor);
    expect(actor.system.movement.ground.bonus).toBe(0);
    expect(fast.system.value).toBe(0);
    expect(fast.flags.essence20.rules.choices.movement).toBe('ground');
    await migrateActorPerkChoices(actor);
    expect(actor.system.movement.ground.bonus).toBe(0);
  });
});

describe('migration fold: the multi-Skill Perks\' copies become one list item per grant', () => {
  const gij = PACK.get('F9kOLys1Iu4UOg22');
  const commando = (choice, collectionId, extra = {}) => copyOf(gij, {
    choice, system: { choiceType: 'skills', hasChoice: true, value: 2 },
    flags: { essence20: { perkValueRule: false, parentId: 'role1', collectionId, ...(extra.essence20 ?? {}) } },
  });

  test('every picked value kept (no value twice), the total bonus unchanged, the extra copies deleted, safe to re-run', async () => {
    const one = commando('athletics', 'lvl1');
    one.name = 'Expertise (E20.SkillAthletics)';
    const two = commando('brawn', 'lvl1', { essence20: { rules: { toggles: { focus: true } } } });
    const three = commando('might', 'lvl7');
    const four = commando('infiltration', 'lvl7');
    const actor = makeActor([one, two, three, four]);
    for (const skill of ['athletics', 'brawn', 'might', 'infiltration']) {
      actor.system.skills[skill].shiftUp = 2;
    }

    const before = () => {
      rebuildIndex(actor);
      ruleDerived(actor);
      return ['athletics', 'brawn', 'might', 'infiltration'].map(skill => actor.system.skills[skill].shiftUp);
    };

    const report = await migrateActorPerkChoices(actor);
    expect(actor.items.map(item => item.id)).toEqual([one.id, three.id]);
    expect(one.flags.essence20.rules.choices.skill).toEqual(['athletics', 'brawn']);
    expect(three.flags.essence20.rules.choices.skill).toEqual(['might', 'infiltration']);
    expect(one.name).toBe('Expertise (E20.SkillAthletics, E20.SkillBrawn)');
    expect(one.flags.essence20.rules.toggles.focus).toBe(true);
    expect(report.folded).toHaveLength(2);
    // The baked +2s came off the stored values; the list rule gives each back, once.
    expect(['athletics', 'brawn', 'might', 'infiltration'].map(skill => actor.system.skills[skill].shiftUp)).toEqual([0, 0, 0, 0]);
    expect(before()).toEqual([2, 2, 2, 2]);
    // Again: nothing changes.
    for (const skill of ['athletics', 'brawn', 'might', 'infiltration']) {
      actor.system.skills[skill].shiftUp = 0;
    }

    actor.update.mockClear();
    await migrateActorPerkChoices(actor);
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1);
    expect(before()).toEqual([2, 2, 2, 2]);
  });

  test('a copy whose pick matches no Skill stays out of the fold', async () => {
    const one = commando('athletics', 'g');
    const odd = commando('basketWeaving', 'g');
    const actor = makeActor([one, odd]);
    const plan = await planActorPerkChoices(actor, { perkValue: true });
    const fold = await planPerkCopyFold(actor, plan.rulesById, new Map(plan.itemUpdates.map(update => [update._id, update])));
    expect(fold.deleteIds).toEqual([]);
  });
});

describe('migratePerkChoices: the world pass', () => {
  test('every world actor, every unlinked token actor and every world item (run by migrateWorld); the GM told what was left', async () => {
    const style = PACK.get('2LtDCHxgg9bMvWQK');
    const pc = makeActor([copyOf(style, { choice: 'akimbo' })]);
    const minion = makeActor([copyOf(style, { choice: 'careful' })]);
    const linked = makeActor([copyOf(style, { choice: 'defense' })]);
    const worldItem = copyOf(style, { choice: 'nonsense' });
    game.actors = [pc];
    game.scenes = [{ tokens: [{ actorLink: false, actor: minion }, { actorLink: true, actor: linked }] }];
    game.items = [worldItem];
    global.ChatMessage = { create: jest.fn(async () => {}), getWhisperRecipients: () => [{ id: 'gm' }] };
    const report = await migratePerkChoices();
    expect(pc.items[0].flags.essence20.rules.choices.style).toBe('akimbo');
    expect(minion.items[0].flags.essence20.rules.choices.style).toBe('careful');
    expect(linked.update).not.toHaveBeenCalled();
    expect(report.unmatched).toEqual([expect.objectContaining({ value: 'nonsense' })]);
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ whisper: ['gm'] }));
    // A second run changes nothing (no gate any more - every step is value-matched).
    pc.update.mockClear();
    await migratePerkChoices();
    expect(pc.update).not.toHaveBeenCalled();
    game.user.isGM = false;
    expect(await migratePerkChoices()).toBeNull();
  });
});

describe('migrateActorData: M1 / M2 in the actor\'s own update (the fold left to migrateActorPerkChoices)', () => {
  test('the unbake and its flag land in the same update data as the copied pick', async () => {
    const acute = PACK.get('WvjGJ5AcC0z07d0J');
    const sense = copyOf(acute, { choice: 'sight', system: { choiceType: 'senses', hasChoice: true } });
    const live = makeActor([sense], { senses: { ...makeActor().system.senses, sight: { acute: true } } });
    live._id = live.id;
    game.actors = Object.assign([live], { get: id => (id == live.id ? live : null) });
    game.settings.get = jest.fn(() => '6.0.0');
    global.foundry.utils.isNewerVersion = () => false;
    global.foundry.utils.isEmpty = value => !value || !Object.keys(value).length;
    const move = { altMode: 0, base: 30, bonus: 0, morphed: 0, total: 30 };
    const source = {
      _id: live.id, type: 'playerCharacter', items: [{ _id: sense.id, type: 'perk' }],
      system: {
        initiative: {}, skills: { acrobatics: { essences: { speed: true } } }, movement: { aerial: move, ground: move, swim: move },
        senses: clone(live.system.senses), environments: [],
      },
    };
    const update = await migration.migrateActorData(source);
    expect(update['system.senses.sight.acute']).toBe(false);
    expect(update.items.find(item => item._id == sense.id)).toMatchObject({
      'flags.essence20.rules.choices.sense': 'sight', 'flags.essence20.choiceMigration.unbaked': true, 'system.hasChoice': false,
    });
  });
});

describe('the GM summary', () => {
  test('an item seen by both the actor pass and the sweep is counted once (live test 2026-10-07)', () => {
    const entry = { actor: 'Hero', item: 'Expertise', value: ['athletics'] };
    const text = perkChoiceReportText({ copied: [entry, { ...entry }], recorded: [], unbaked: [], folded: [], unmatched: [], unpicked: [{ actor: 'Hero', item: 'Cutie Mark Perk' }, { actor: 'Hero', item: 'Cutie Mark Perk' }], clamped: [] });
    expect(text.summary).toContain('copied 1');
    expect(text.summary).toContain('unpicked 1');
    expect(text.lines).toHaveLength(1);
  });
});
