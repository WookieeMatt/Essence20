import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuildIndex } from './index.mjs';
import { ruleRollSources } from './adapter.mjs';
import { runUse, useAvailable, useRulesOf } from './triggers.mjs';
import { runSteps, stepContext } from './steps.mjs';
import { consumeBanked } from './bank.mjs';
import { registerCheck, setWorldLookups } from './predicate.mjs';
import { legacyChoiceUpdates } from './legacy-choices.mjs';

/**
 * Round 3 of the slC slices (gij1, gij2, gij3, fix3-gij, situational1, situational2): Ceremonial,
 * Primal Fear (with Feed On Fear) and Weatherproof, moved from hand-written code to item rules.
 * Each item is loaded from its pack source and must do what the removed code did.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const FEED_ON_FEAR = 'Compendium.essence20.cobra_codex.Item.dZkRZSH5X88PrSyK';

let nextId = 1;
let epoch = 1;

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

function updater(doc) {
  return async data => {
    for (const [key, value] of Object.entries(data)) {
      setPath(doc, key, value);
    }
  };
}

/** An item from a pack source (or plain data), ready to sit on an actor. */
function packItem(file, extra = {}) {
  const doc = file ? fromPack(file) : {};
  const item = {
    id: extra.id ?? `i${nextId++}`, name: extra.name ?? doc.name, type: extra.type ?? doc.type,
    flags: { ...(extra.source ? { core: { sourceId: extra.source } } : {}), essence20: { ...(extra.flags ?? {}) } },
    system: { ...(doc.system ?? {}), ...(extra.system ?? {}) },
  };
  item.uuid = `Item.${item.id}`;
  item.update = updater(item);
  return item;
}

function makeActor(items, { system = {}, uuid = null } = {}) {
  const actor = {
    id: `a${nextId++}`, name: 'Hero', type: 'playerCharacter', isOwner: true, statuses: new Set(),
    flags: { essence20: {} },
    system: { level: 3, health: { value: 5, max: 10 }, ...system },
    getFlag(scope, key) {
      return foundry.utils.getProperty(this.flags[scope] ?? {}, key);
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
  };
  actor.uuid = uuid ?? `Actor.${actor.id}`;
  actor.update = updater(actor);
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  items.forEach(item => (item.parent = actor));
  rebuildIndex(actor);
  return actor;
}

function foe(name = 'Foe') {
  const doc = {
    id: `f${nextId++}`, name, isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { defenses: { willpower: { total: 14 }, cleverness: { total: 11 } } },
  };
  doc.uuid = `Actor.${doc.id}`;
  doc.update = updater(doc);
  return doc;
}

function target(...actors) {
  game.user.targets = new Set(actors.map(actor => ({ actor })));
}

/** Answers each choose step in turn. */
const answers = (...list) => async () => list.shift() ?? null;
const pay = () => jest.fn(async () => true);

beforeEach(() => {
  epoch = 1;
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, actors: { contents: [] },
    i18n: { localize: k => k, format: k => k }, settings: { get: () => epoch },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o), randomID: () => `r${nextId++}` },
  };
});

/* -------------------------------------------- */
/*  Ceremonial (gij1)                            */
/* -------------------------------------------- */

describe('Ceremonial', () => {
  const FILE = 'ccitems/_source/Ceremonial_vf9rJxOwuxDzrPKp.json';

  function wearer({ equipped = true } = {}) {
    const armor = packItem(null, { name: 'Battledress', type: 'armor', system: { equipped } });
    const upgrade = packItem(FILE, { flags: { parentId: armor.id } });
    const actor = makeActor([armor, upgrade]);
    return { actor, upgrade };
  }

  async function rollPersuasion(actor) {
    const out = ruleRollSources(actor, null, { rolledSkill: 'persuasion' });
    for (const consume of out.consumes) {
      await consumeBanked(consume, async () => actor);
    }

    return out.sources;
  }

  test('out of combat: a Free action for ↑1 on the next Persuasion test this scene, then usable again', async () => {
    const { actor, upgrade } = wearer();
    const paid = pay();
    expect(await runUse(upgrade, paid)).toBeTruthy();
    expect(paid).toHaveBeenCalledWith('free');
    expect(ruleRollSources(actor, null, { rolledSkill: 'science' }).sources).toEqual([]);
    expect(useAvailable(upgrade, upgrade.system.rules[0], 0)).toBe(false);
    expect(await rollPersuasion(actor)).toEqual([expect.objectContaining({ label: 'Ceremonial', shiftUp: 1 })]);
    expect(await rollPersuasion(actor)).toEqual([]);
    expect(useAvailable(upgrade, upgrade.system.rules[0], 0)).toBe(true);

    // Unused, it ends with the scene.
    expect(await runUse(upgrade, pay())).toBeTruthy();
    epoch = 2;
    expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion' }).sources).toEqual([]);
    expect(useAvailable(upgrade, upgrade.system.rules[0], 0)).toBe(true);
  });

  test('in combat: every Persuasion test this turn gets ↑1, not used up; gone next turn', async () => {
    const { actor, upgrade } = wearer();
    game.combat = { started: true, id: 'c', round: 1, turn: 0, turns: [{ actor }] };
    expect(await runUse(upgrade, pay())).toBeTruthy();
    expect(await rollPersuasion(actor)).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(await rollPersuasion(actor)).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(useAvailable(upgrade, upgrade.system.rules[0], 0)).toBe(false);
    game.combat.turn = 1;
    expect(await rollPersuasion(actor)).toEqual([]);
    expect(useAvailable(upgrade, upgrade.system.rules[0], 0)).toBe(true);
  });

  test('only while its armor is worn', () => {
    const { upgrade } = wearer({ equipped: false });
    expect(useRulesOf(upgrade)).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Primal Fear / Feed On Fear (gij1)            */
/* -------------------------------------------- */

describe('Primal Fear', () => {
  const FILE = 'ccitems/_source/Primal_Fear_xoD8fbVVqymTidNJ.json';
  let inEnvironment = true;

  beforeAll(() => {
    registerCheck('environmentalExpertise', () => inEnvironment);
  });

  beforeEach(() => {
    inEnvironment = true;
  });

  function hunter({ feedOnFear = false, health = { value: 5, max: 10 } } = {}) {
    const perk = packItem(FILE);
    const items = [perk, ...(feedOnFear ? [packItem('ccitems/_source/Feed_On_Fear_dZkRZSH5X88PrSyK.json', { source: FEED_ON_FEAR })] : [])];
    const actor = makeActor(items, { system: { health } });
    let success = true;
    actor._dice = { rollSkill: jest.fn(async () => ({ success, outcomes: [{ results: [{ multiplier: 1 }] }] })) };
    return { actor, perk, fail: () => (success = false) };
  }

  const useRule = perk => perk.system.rules.findIndex(rule => rule.type == 'Use');
  const available = perk => useAvailable(perk, perk.system.rules[useRule(perk)], useRule(perk));
  const shifts = (actor, other) => ruleRollSources(actor, other, { rolledSkill: 'athletics' }).sources;

  test('needs the environment of expertise', () => {
    const { perk } = hunter();
    inEnvironment = false;
    expect(available(perk)).toBe(false);
    inEnvironment = true;
    expect(available(perk)).toBe(true);
  });

  test('in combat: Survival against Willpower or Cleverness, a Free action once per turn; ↑1 against that creature this turn', async () => {
    const { actor, perk } = hunter();
    game.combat = { started: true, id: 'c', round: 1, turn: 0, turns: [{ actor }] };
    const scared = foe();
    const other = foe('Other');
    target(scared);
    const paid = pay();
    expect(await runUse(perk, paid, { ask: answers(1) })).toContain('unnerves');
    expect(paid).toHaveBeenCalledWith('free');
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'survival', dif: '11' }), actor);
    expect(shifts(actor, scared)).toEqual([expect.objectContaining({ label: 'Primal Fear', shiftUp: 1 })]);
    expect(shifts(actor, other)).toEqual([]);
    expect(shifts(actor, null)).toEqual([]);
    expect(available(perk)).toBe(false);

    game.combat.turn = 1;
    expect(shifts(actor, scared)).toEqual([]);
    expect(available(perk)).toBe(true);
  });

  test('a failure posts it, sets no mark and still uses the turn', async () => {
    const { actor, perk, fail } = hunter();
    game.combat = { started: true, id: 'c', round: 1, turn: 0, turns: [{ actor }] };
    fail();
    const scared = foe();
    target(scared);
    expect(await runUse(perk, pay(), { ask: answers(0) })).toContain('fails to unnerve');
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ dif: '14' }), actor);
    expect(shifts(actor, scared)).toEqual([]);
    expect(available(perk)).toBe(false);
  });

  test('nothing targeted: no roll, no mark', async () => {
    const { actor, perk } = hunter();
    await runUse(perk, pay(), { ask: answers(0) });
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test('out of combat: no turn limit, and the ↑1 lasts the scene', async () => {
    const { actor, perk } = hunter();
    const scared = foe();
    target(scared);
    expect(await runUse(perk, pay(), { ask: answers(0) })).toBeTruthy();
    expect(available(perk)).toBe(true);
    expect(shifts(actor, scared)).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    epoch = 2;
    expect(shifts(actor, scared)).toEqual([]);
  });

  test('Feed On Fear: heal 1 Health instead of the ↑1, never past the maximum', async () => {
    const { actor, perk } = hunter({ feedOnFear: true, health: { value: 9, max: 10 } });
    const scared = foe();
    target(scared);
    expect(await runUse(perk, pay(), { ask: answers(0, 1) })).toBeTruthy();
    expect(actor.system.health.value).toBe(10);
    expect(shifts(actor, scared)).toEqual([]);
    expect(await runUse(perk, pay(), { ask: answers(0, 1) })).toBeTruthy();
    expect(actor.system.health.value).toBe(10);

    expect(await runUse(perk, pay(), { ask: answers(0, 0) })).toContain('unnerves');
    expect(shifts(actor, scared)).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  });

  test('without Feed On Fear there is no heal choice', async () => {
    const { actor, perk } = hunter();
    const ask = jest.fn(answers(0));
    target(foe());
    await runUse(perk, pay(), { ask });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(actor.system.health.value).toBe(5);
  });
});

/* -------------------------------------------- */
/*  Weatherproof (situational1)                  */
/* -------------------------------------------- */

describe('Weatherproof', () => {
  const FILES = ['gijcrbitems/_source/Weatherproof_Vo0m83m6fHo4BHOY.json', 'prcrbitems/_source/Weatherproof_Vo0m83m6fHo4BHOY.json'];

  afterEach(() => setWorldLookups({ environment: undefined }));

  function armed({ file = FILES[0], environment = 'underwater', traits = [], style = 'ranged', damageType = 'blunt', swim = 0, equipped = true } = {}) {
    const weapon = packItem(null, { name: 'Rifle', type: 'weapon', system: { traits, equipped } });
    const upgrade = packItem(file, { flags: { parentId: weapon.id, rules: { choices: { environment } } } });
    const effect = packItem(null, { name: 'Shot', type: 'weaponEffect', flags: { parentId: weapon.id }, system: { classification: { style }, damageType } });
    const actor = makeActor([weapon, upgrade, effect], { system: { movement: { swim: { total: swim } } } });
    return { actor, weapon, upgrade, effect };
  }

  const at = environment => setWorldLookups({ environment: () => environment });
  const sourcesOf = ({ actor, effect }) => ruleRollSources(actor, null, { item: effect }).sources;

  test.each(FILES)('the Use picks the environment (%s), and an old pick is kept', async (file) => {
    const { actor, upgrade } = armed({ file, environment: null });
    const rule = upgrade.system.rules.find(r => r.type == 'Use');
    const ctx = stepContext({ actor, item: upgrade, rule, targets: [] });
    ctx.askPick = async (step, options) => {
      expect(options.map(o => o.value)).toEqual(['underwater', 'lowGravity', 'zeroGravity', 'vacuum', 'normal']);
      return 'vacuum';
    };

    expect(await runSteps(rule.steps, ctx)).toBe(true);
    expect(upgrade.flags.essence20.rules.choices.environment).toBe('vacuum');

    const old = armed({ file, environment: null });
    old.upgrade.flags.essence20.s1Environment = 'lowGravity';
    expect(legacyChoiceUpdates(old.actor)).toEqual([{ _id: old.upgrade.id, 'flags.essence20.rules.choices.environment': 'lowGravity' }]);
  });

  test('underwater: Edge and the fire ↑2, only in the chosen environment', () => {
    const rig = armed({ damageType: 'fire' });
    at('underwater');
    expect(sourcesOf(rig)).toEqual([
      expect.objectContaining({ label: 'Weatherproof (Underwater)', edge: true }),
      expect.objectContaining({ label: 'Weatherproof (Underwater)', shiftUp: 2 }),
    ]);
    at('vacuum');
    expect(sourcesOf(rig)).toEqual([]);
    at('underwater');
    expect(sourcesOf(armed({ environment: 'vacuum', damageType: 'fire' }))).toEqual([]);
  });

  test('underwater melee: no Edge for a swimmer, nor for an amphibious or aquatic weapon', () => {
    at('underwater');
    expect(sourcesOf(armed({ style: 'melee' }))).toEqual([expect.objectContaining({ edge: true })]);
    expect(sourcesOf(armed({ style: 'melee', swim: 20 }))).toEqual([]);
    expect(sourcesOf(armed({ swim: 20 }))).toEqual([expect.objectContaining({ edge: true })]);
    expect(sourcesOf(armed({ traits: ['aquatic'] }))).toEqual([]);
    expect(sourcesOf(armed({ traits: ['amphibious'] }))).toEqual([]);
  });

  test('low gravity: ranged ballistic, not inertial', () => {
    at('lowGravity');
    expect(sourcesOf(armed({ environment: 'lowGravity', traits: ['ballistic'] }))).toEqual([expect.objectContaining({ label: 'Weatherproof (Low Gravity)', edge: true })]);
    expect(sourcesOf(armed({ environment: 'lowGravity' }))).toEqual([]);
    expect(sourcesOf(armed({ environment: 'lowGravity', traits: ['ballistic', 'inertial'] }))).toEqual([]);
    expect(sourcesOf(armed({ environment: 'lowGravity', traits: ['ballistic'], style: 'melee' }))).toEqual([]);
  });

  test('zero gravity: not energy or laser; vacuum: any ranged, not inertial', () => {
    at('zeroGravity');
    expect(sourcesOf(armed({ environment: 'zeroGravity' }))).toEqual([expect.objectContaining({ edge: true })]);
    expect(sourcesOf(armed({ environment: 'zeroGravity', traits: ['energy'] }))).toEqual([]);
    expect(sourcesOf(armed({ environment: 'zeroGravity', damageType: 'laser' }))).toEqual([]);
    at('vacuum');
    expect(sourcesOf(armed({ environment: 'vacuum' }))).toEqual([expect.objectContaining({ label: 'Weatherproof (Vacuum)', edge: true })]);
    expect(sourcesOf(armed({ environment: 'vacuum', traits: ['inertial'] }))).toEqual([]);
    expect(sourcesOf(armed({ environment: 'vacuum', style: 'melee' }))).toEqual([]);
  });

  test('on land: an aquatic (not amphibious) weapon gets ↑3', () => {
    at('normal');
    expect(sourcesOf(armed({ environment: 'normal', traits: ['aquatic'] }))).toEqual([expect.objectContaining({ label: 'Weatherproof (On land)', shiftUp: 3 })]);
    expect(sourcesOf(armed({ environment: 'normal', traits: ['aquatic', 'amphibious'] }))).toEqual([]);
    expect(sourcesOf(armed({ environment: 'normal' }))).toEqual([]);
  });

  test('only the weapon it is attached to; two weapons each keep their own', () => {
    at('vacuum');
    const first = armed({ environment: 'vacuum' });
    const spare = packItem(null, { name: 'Pistol', type: 'weapon', system: { traits: [], equipped: true } });
    const spareUpgrade = packItem(FILES[0], { flags: { parentId: spare.id, rules: { choices: { environment: 'vacuum' } } } });
    const spareShot = packItem(null, { type: 'weaponEffect', flags: { parentId: spare.id }, system: { classification: { style: 'ranged' } } });
    const bare = packItem(null, { name: 'Bare', type: 'weapon', system: { traits: [], equipped: true } });
    const bareShot = packItem(null, { type: 'weaponEffect', flags: { parentId: bare.id }, system: { classification: { style: 'ranged' } } });
    const actor = makeActor([first.weapon, first.upgrade, first.effect, spare, spareUpgrade, spareShot, bare, bareShot]);
    expect(ruleRollSources(actor, null, { item: first.effect }).sources).toHaveLength(1);
    expect(ruleRollSources(actor, null, { item: spareShot }).sources).toHaveLength(1);
    expect(ruleRollSources(actor, null, { item: bareShot }).sources).toEqual([]);
  });
});
