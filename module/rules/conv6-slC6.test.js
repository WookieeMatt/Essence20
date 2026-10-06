import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuildIndex } from './index.mjs';
import { ruleDialogSwitches, ruleMovement, ruleMovementStages, ruleRollSources, ruleSpecializes } from './adapter.mjs';
import { registerCheck, setWorldLookups } from './predicate.mjs';
import { useAvailable } from './triggers.mjs';
import { runSteps, stepContext } from './steps.mjs';
import { runPostRoll } from '../helpers/extensions.mjs';
import * as sit2 from '../helpers/extensions/situational2/common.mjs';

/**
 * Round 6 of the slC slices (gij1, gij2, gij3, fix3-gij, situational1, situational2): items moved from
 * hand-written code to item rules with the round-6 engine pieces (Movement afterDerived + round,
 * combat:enemyStatus, the notDouble outcome), plus Urban Jungle, whose code was in dice.mjs. Each item
 * is loaded from its pack source and must do what the removed code did.
 *
 * The position checks are registered here the way essence20.mjs registers them - on situational2's own
 * readings (helpers/extensions/situational2/common.mjs), fed by the same lookups.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const GIJ = id => `Compendium.essence20.gi_joe_crb.Item.${id}`;

const FILES = {
  expertKnowledge: 'gijcrbitems/_source/Expert_Knowledge_9H78lRwXzJW6tj9e.json',
  sharksFin: 'qgtgitems/_source/Shark_s_Fin_c3tBbGzXDar3DA1E.json',
  seaLegs: 'ccitems/_source/Sea_Legs_mKsSa2HBOimHqS7i.json',
  shipShape: 'qgtgitems/_source/Ship_Shape_MejI6WIShcA0GdoW.json',
  ambushMaster: 'gijcrbitems/_source/Ambush_Master_UYaPTaAQH5SDXxnz.json',
  urbanJungle: 'ccitems/_source/Urban_Jungle_wIesQd7U5W2azAWY.json',
};

let nextId = 1;

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

function makeActor(items, { system = {}, flags = {}, type = 'playerCharacter', statuses = [] } = {}) {
  const actor = {
    id: `a${nextId++}`, name: 'Hero', type, isOwner: true, statuses: new Set(statuses),
    flags: { essence20: { ...flags } },
    system: { level: 3, health: { value: 5, max: 10 }, ...system },
    getActiveTokens: () => [],
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.update = updater(actor);
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  items.forEach(item => (item.parent = actor));
  rebuildIndex(actor);
  return actor;
}

const labels = list => list.map(entry => entry.label);
const edgeSources = (actor, target, ctx) => ruleRollSources(actor, target, ctx).sources.filter(source => source.edge);

// Where the token stands - read by the rules' terrain:/environment: tags and by situational2's checks.
const world = { terrain: null, environment: 'normal', outside: 'normal' };

beforeAll(() => {
  setWorldLookups({ terrain: () => world.terrain, environment: () => world.environment, environmentOutside: () => world.outside });
  for (const name of ['inWater', 'onLand', 'seaOrWetlands', 'aboardAquaticVessel', 'completeDarkness']) {
    const fn = { inWater: sit2.isInWater, onLand: sit2.isOnLand, seaOrWetlands: sit2.isSeaOrWetlands, aboardAquaticVessel: sit2.isAboardAquaticVessel, completeDarkness: sit2.isCompleteDarkness }[name];
    registerCheck(name, actor => fn(actor));
  }
});

beforeEach(() => {
  Object.assign(world, { terrain: null, environment: 'normal', outside: 'normal' });
  sit2.deps.getTerrain = () => world.terrain;
  sit2.deps.getEnvironment = () => world.outside;
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: [], actors: { contents: [] },
    i18n: { localize: k => k, format: k => k }, settings: { get: () => 1 },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.fromUuidSync = () => null;
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o), randomID: () => `r${nextId++}` },
  };
});

/* -------------------------------------------- */
/*  gij2: Expert Knowledge (re-checked)          */
/* -------------------------------------------- */

describe('Expert Knowledge', () => {
  async function rolled(actor, results, extra = {}) {
    global.ChatMessage.create.mockClear();
    await runPostRoll(actor, results, { riderContext: { skill: 'science' } }, { hits: [], rider: { skill: 'science' }, ...extra });
    return global.ChatMessage.create.mock.calls.map(([data]) => data.content).join('\n');
  }

  test('a Fumble that still beats the DIF (not by double) notes 1 benefit, as the old hook did', async () => {
    const actor = makeActor([packItem(FILES.expertKnowledge, { flags: { rules: { choices: { skill: 'science' } } } })]);
    const fumbledThrough = await rolled(actor, [{ success: true, multiplier: 1 }], { isFumble: true });
    expect(fumbledThrough).toContain('1 additional benefit');
    expect(fumbledThrough).not.toContain('2 additional benefits');

    const fumbledDouble = await rolled(actor, [{ success: true, multiplier: 2 }], { isFumble: true });
    expect(fumbledDouble).toContain('2 additional benefits');
    expect(fumbledDouble).not.toContain('1 additional benefit,');

    expect(await rolled(actor, [{ success: false, multiplier: 0 }], { isFumble: true })).toBe('');
    expect(await rolled(actor, [{ success: true, multiplier: 1 }])).toContain('1 additional benefit');
    expect(await rolled(actor, [{ success: true, multiplier: 2 }])).toContain('2 additional benefits');
  });

  test('only on the chosen Skill', async () => {
    const actor = makeActor([packItem(FILES.expertKnowledge, { flags: { rules: { choices: { skill: 'culture' } } } })]);
    expect(await rolled(actor, [{ success: true, multiplier: 1 }], { isFumble: true })).toBe('');
  });
});

/* -------------------------------------------- */
/*  situational2: Shark's Fin, Ship Shape        */
/* -------------------------------------------- */

describe('Shark\'s Fin (Movement after every derived adjustment)', () => {
  const swimmer = (files, movement) => makeActor(files.map(file => packItem(file)), { system: { movement } });

  test('doubles Ground and Aquatic Movement at sea, in wetlands or aboard an aquatic vessel - at stage afterDerived', () => {
    const actor = swimmer([FILES.sharksFin], { ground: { total: 30 }, swim: { total: 30 }, aerial: { total: 0 } });
    world.terrain = 'sea';
    let stage = ruleMovementStages(actor);
    expect([stage('afterDerived', 'ground', 30), stage('afterDerived', 'swim', 25), stage('afterDerived', 'aerial', 10)]).toEqual([60, 50, null]);
    expect(stage('afterGravity', 'ground', 30)).toBe(null);
    expect(stage('final', 'ground', 30)).toBe(null);
    world.terrain = 'wetlands';
    expect(ruleMovementStages(actor)('afterDerived', 'ground', 30)).toBe(60);
    world.terrain = 'urban';
    stage = ruleMovementStages(actor);
    expect(stage('afterDerived', 'ground', 30)).toBe(null);
    game.actors.contents = [{ type: 'vehicle', system: { actors: { x: { uuid: actor.uuid } }, movement: { swim: { total: 20 } } } }];
    expect(ruleMovementStages(actor)('afterDerived', 'swim', 30)).toBe(60);
  });

  test('with Sea Legs, Sea Legs first (after gravity), then the doubling', () => {
    world.terrain = 'sea';
    const wet = swimmer([FILES.seaLegs, FILES.sharksFin], { swim: { total: 20 } });
    const afterGravity = ruleMovementStages(wet)('afterGravity', 'swim', 20);
    expect(afterGravity).toBe(35);
    expect(ruleMovementStages(wet)('afterDerived', 'swim', afterGravity)).toBe(70);
    const dry = swimmer([FILES.seaLegs, FILES.sharksFin], { swim: { total: 0 } });
    expect(ruleMovementStages(dry)('afterDerived', 'swim', ruleMovementStages(dry)('afterGravity', 'swim', 0))).toBe(60);
  });

  test('a hand-written derived +10 Ground now lands before the doubling, as it did when situational2 ran after it', () => {
    world.terrain = 'sea';
    const actor = swimmer([FILES.sharksFin], { ground: { total: 30 } });
    // e.g. Yo Joe!'s battle cry (other2/gij.mjs, a derived hook registered before situational2).
    expect(ruleMovementStages(actor)('afterDerived', 'ground', 30 + 10)).toBe(80);
  });
});

describe('Ship Shape: the aquatic vehicle its holder drives moves half again (rounded down)', () => {
  function boat({ role = 'driver', swim = 50, ground = 25, type = 'vehicle', perk = true } = {}) {
    const driver = makeActor(perk ? [packItem(FILES.shipShape)] : []);
    global.fromUuidSync = uuid => (uuid == driver.uuid ? driver : null);
    const vehicle = makeActor([], { type, system: { actors: { d: { uuid: driver.uuid, vehicleRole: role } }, movement: { swim: { base: swim, total: swim }, ground: { base: ground, total: ground }, aerial: { total: 0 } } } });
    return { driver, vehicle };
  }

  test('every Movement x1.5, rounded down, after the derived adjustments', () => {
    const { vehicle } = boat();
    const stage = ruleMovementStages(vehicle);
    expect([stage('afterDerived', 'swim', 50), stage('afterDerived', 'ground', 25), stage('afterDerived', 'aerial', 0)]).toEqual([75, 37, 0]);
    expect(stage('afterGravity', 'swim', 50)).toBe(null);
    expect(stage('final', 'swim', 50)).toBe(null);
  });

  test('aquatic when the base or the total has Aquatic Movement', () => {
    const { vehicle } = boat({ swim: 0 });
    expect(ruleMovementStages(vehicle)('afterDerived', 'ground', 25)).toBe(null);
    vehicle.system.movement.swim.total = 10;
    expect(ruleMovementStages(vehicle)('afterDerived', 'ground', 25)).toBe(37);
  });

  test('not a gunner\'s vehicle, not a Zord, not the driver, nor without the Perk', () => {
    expect(ruleMovementStages(boat({ role: 'gunner' }).vehicle)('afterDerived', 'swim', 50)).toBe(null);
    expect(ruleMovementStages(boat({ perk: false }).vehicle)('afterDerived', 'swim', 50)).toBe(null);
    const zord = boat({ type: 'zord' });
    expect(ruleMovementStages(zord.vehicle)('afterDerived', 'swim', 50)).toBe(null);
    expect(ruleMovementStages(zord.driver)('afterDerived', 'swim', 50)).toBe(null);
  });

  test('Feet Wet for the driven vehicle stays a vehicle-only benefit (a Zord gets none, as before)', () => {
    const zord = boat({ type: 'zord' }).vehicle;
    expect(edgeSources(zord, null, { rolledSkill: 'driving' })).toEqual([]);
    expect(ruleMovement(zord).ignoreRoughTerrain).toBeFalsy();
    const vehicle = boat().vehicle;
    expect(labels(edgeSources(vehicle, null, { rolledSkill: 'driving' }))).toEqual(['Feet Wet (Ship Shape: the aquatic vehicle you drive, non-combat tests)']);
    expect(ruleMovement(vehicle).ignoreRoughTerrain).toBe(true);
  });
});

/* -------------------------------------------- */
/*  situational1: Ambush Master                  */
/* -------------------------------------------- */

describe('Ambush Master', () => {
  const SHOTGUN = GIJ('2qW1YLopvjKyezNQ');
  const SMG = GIJ('oJInlAgdYZzjH7bk');

  function setup({ weapon = SHOTGUN, foeStatuses = ['surprised'], foeType = 'npc', combat = true } = {}) {
    const perk = packItem(FILES.ambushMaster);
    const items = [perk];
    if (weapon) {
      items.push({ id: `w${nextId++}`, name: 'Gun', type: 'weapon', flags: { core: { sourceId: weapon } }, system: {} });
    }

    const actor = makeActor(items);
    const foe = makeActor([], { type: foeType, statuses: foeStatuses });
    game.combat = combat ? { id: 'c1', started: false, round: 0, turn: 0, combatants: { contents: [{ actor }, { actor: foe }] } } : null;
    const rule = perk.system.rules.find(entry => entry.type == 'Use');
    return { actor, perk, rule, index: perk.system.rules.indexOf(rule) };
  }

  test('offered in a combat (started or not) while an enemy combatant is Surprised and a shotgun or SMG is owned', () => {
    for (const weapon of [SHOTGUN, SMG]) {
      const { perk, rule, index } = setup({ weapon });
      expect(useAvailable(perk, rule, index)).toBe(true);
    }

    for (const options of [{ weapon: null }, { weapon: 'Compendium.essence20.gi_joe_crb.Item.pistol' }, { foeStatuses: [] }, { foeType: 'playerCharacter' }, { combat: false }]) {
      const { perk, rule, index } = setup(options);
      expect(useAvailable(perk, rule, index)).toBe(false);
    }
  });

  test('once per encounter; a bonus attack at no action cost, and the line is posted even off the turn order', async () => {
    const { actor, perk, rule } = setup();
    expect(rule.limit).toEqual({ per: 'encounter' });
    const economy = { grantBonusAttack: jest.fn(async () => true) };
    const ctx = stepContext({ actor, item: perk, rule, targets: [] });
    ctx.economy = economy;
    expect(await runSteps(rule.steps, ctx)).not.toBe(false);
    expect(economy.grantBonusAttack).toHaveBeenCalledWith(actor, expect.objectContaining({ source: 'Ambush Master', cost: 'none', filter: null }));
    expect(ctx.chat.join(' ')).toContain('Hero surprised an enemy and gains one extra shotgun or submachine gun attack this turn.');

    const offTheOrder = stepContext({ actor, item: perk, rule, targets: [] });
    offTheOrder.economy = { grantBonusAttack: jest.fn(async () => false) };
    expect(await runSteps(rule.steps, offTheOrder)).not.toBe(false);
    expect(offTheOrder.chat.join(' ')).toContain('surprised an enemy');
  });
});

/* -------------------------------------------- */
/*  Urban Jungle (its code was in dice.mjs)      */
/* -------------------------------------------- */

describe('Urban Jungle', () => {
  const effect = { type: 'weaponEffect', name: 'Knife', system: {}, flags: {} };
  const jungle = () => makeActor([packItem(FILES.urbanJungle)]);

  test('on urban terrain: Edge on non-attack tests, attacks Specialized', () => {
    world.terrain = 'urban';
    const actor = jungle();
    expect(labels(edgeSources(actor, null, { rolledSkill: 'alertness' }))).toEqual(['Urban Jungle (non-attack tests in the city)']);
    expect(edgeSources(actor, null, { item: effect })).toEqual([]);
    expect(ruleSpecializes(actor, 'targeting', effect)).toBe(true);
    expect(ruleSpecializes(actor, 'alertness', null)).toBe(false);
    expect(edgeSources(actor, null, { rolledSkill: 'alertness', dataset: { isInitiative: true } })).toEqual([]);
  });

  test('nothing elsewhere, and nothing asked on a scene with no terrain set', () => {
    world.terrain = 'woodlands';
    const actor = jungle();
    expect(edgeSources(actor, null, { rolledSkill: 'alertness' })).toEqual([]);
    expect(ruleSpecializes(actor, 'targeting', effect)).toBe(false);
    world.terrain = null;
    expect(edgeSources(actor, null, { rolledSkill: 'alertness' })).toEqual([]);
    expect(ruleSpecializes(actor, 'targeting', effect)).toBe(false);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'alertness' })).toEqual([]);
    expect(ruleDialogSwitches(actor, { item: effect })).toEqual([]);
  });
});
