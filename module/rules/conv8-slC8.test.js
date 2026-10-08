import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuildIndex } from './index.mjs';
import { ruleMovement, ruleRollSources } from './adapter.mjs';
import { registerCheck, setWorldLookups } from './predicate.mjs';
import { fireTriggers, runUse } from './triggers.mjs';
import { runPostRoll } from '../mechanics/item-hooks.mjs';

/**
 * Round 8 of the slC slices (gij1, gij2, gij3, fix3-gij, situational1, situational2): items moved from
 * hand-written code to item rules with the round-8 engine pieces (@sum.equipped, marks per setter). Each
 * item is loaded from its pack source and must do what the removed slice code did:
 * - Jungle Fighter / Out of the Jungle (situational1): light armor counts as Silent - the Infiltration
 *   penalty the worn light armor adds is handed back as ↑, in the jungle (or anywhere with Out of the Jungle).
 * - Earth Defense Command Benefits (situational1): ↑2 on Driving while piloting a vehicle with Aerial Movement.
 * - Forgiving (situational2): whoever attacks or Intimidates the holder is remembered; the holder's next
 *   Empathy test against them has Edge, and forgives them.
 * - Plow (situational2): a Ram makes the rest of the turn's movement ignore Rough Terrain (its own, or the
 *   vehicle's it drives).
 * - Primal Fear (gij1, converted in round 3): with nothing targeted the Free action isn't paid, and two
 *   hunters' marks on one creature no longer replace each other.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  jungleFighter: 'sssitems/_source/Jungle_Fighter_RWgIeFdT0c1vIcS1.json',
  outOfTheJungle: 'sssitems/_source/Out_of_the_Jungle_5jc5fjieruLuWQm1.json',
  earthDefense: 'fgtaaitems/_source/Earth_Defense_Command_Benefits_uQQbRbwADVtVwsym.json',
  forgiving: 'mlpcrbitems/_source/Forgiving_985JSL4ANRcKb1EX.json',
  plow: 'tfcrbitems/_source/Plow_y7VBydpKD8O63C3b.json',
};
const EMPATHY = 'Compendium.essence20.mlp_crb.Item.7k1UXzSKyoV8EtXZ';

let nextId = 1;
let sceneEpoch = 1;
let terrain = null;
const byUuid = new Map();

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const at = keys.reduce((node, key) => (node[key] ??= {}), object);
  if (last.startsWith('-=')) {
    delete at[last.slice(2)];
  } else {
    at[last] = value;
  }
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
  byUuid.set(item.uuid, item);
  return item;
}

function makeActor(items, { system = {}, type = 'playerCharacter', name = 'Hero' } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(),
    flags: { essence20: {} },
    system: { level: 20, health: { value: 5, max: 10 }, ...system },
    getActiveTokens: () => [],
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.update = updater(actor);
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  items.forEach(item => (item.parent = actor));
  rebuildIndex(actor);
  byUuid.set(actor.uuid, actor);
  game.actors.contents.push(actor);
  return actor;
}

const armor = (system = {}) => packItem(null, { name: 'Armor', type: 'armor', system: { equipped: true, classification: 'light', traits: [], totalBonusToughness: 1, totalBonusEvasion: 2, ...system } });
const shifts = (actor, ctx, target = null) => ruleRollSources(actor, target, ctx).sources.map(s => ({ label: s.label, up: s.shiftUp, edge: s.edge }));

beforeEach(() => {
  sceneEpoch = 1;
  terrain = null;
  byUuid.clear();
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] }, actors: { contents: [] },
    i18n: { localize: k => k, format: k => k },
    settings: { get: () => sceneEpoch, set: async () => {} },
  };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.fromUuidSync = uuid => byUuid.get(uuid) ?? null;
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o), randomID: () => `r${nextId++}` },
  };
  setWorldLookups({ terrain: () => terrain });
});

/* -------------------------------------------- */
/*  situational1: Jungle Fighter / Out of the Jungle */
/* -------------------------------------------- */

describe('Jungle Fighter / Out of the Jungle: light armor counts as Silent', () => {
  const INFILTRATION = { rolledSkill: 'infiltration' };
  const silentUp = (actor, ctx = INFILTRATION) => shifts(actor, ctx).filter(s => /Silent/.test(s.label));

  test('Out of the Jungle hands back the worn light armor\'s Toughness + Evasion bonus on Infiltration, anywhere', () => {
    terrain = 'desert';
    const actor = makeActor([packItem(FILES.outOfTheJungle), armor()]);
    expect(silentUp(actor)).toEqual([{ label: 'Out of the Jungle (light armor counts as Silent)', up: 3, edge: false }]);
    expect(silentUp(actor, { rolledSkill: 'athletics' })).toEqual([]);
    expect(silentUp(makeActor([packItem(FILES.outOfTheJungle), armor({ totalBonusToughness: 1, totalBonusEvasion: 0 })]))[0].up).toBe(1);
  });

  test('nothing for armor that makes no noise to hand back: not light, Silent, power armor, unworn, no bonus', () => {
    for (const system of [{ classification: 'heavy' }, { traits: ['silent'] }, { isPowerArmor: true }, { equipped: false }, { totalBonusToughness: 0, totalBonusEvasion: 0 }]) {
      expect(silentUp(makeActor([packItem(FILES.outOfTheJungle), armor(system)]))).toEqual([]);
    }

    expect(silentUp(makeActor([packItem(FILES.outOfTheJungle)]))).toEqual([]);
  });

  test('Jungle Fighter only in the jungle: woodlands terrain, or its inJungle toggle where no terrain is set', () => {
    const perk = packItem(FILES.jungleFighter);
    const actor = makeActor([perk, armor()]);
    expect(silentUp(actor)).toEqual([]);
    perk.flags.essence20.rules = { toggles: { inJungle: true } };
    expect(silentUp(actor)).toEqual([{ label: 'Jungle Fighter (light armor counts as Silent)', up: 3, edge: false }]);
    terrain = 'desert';
    expect(silentUp(actor)).toEqual([]);
    terrain = 'woodlands';
    perk.flags.essence20.rules = {};
    expect(silentUp(actor)).toEqual([{ label: 'Jungle Fighter (light armor counts as Silent)', up: 3, edge: false }]);
  });

  test('holding both Perks in the jungle hands it back once', () => {
    terrain = 'woodlands';
    const actor = makeActor([packItem(FILES.jungleFighter), packItem(FILES.outOfTheJungle), armor()]);
    expect(silentUp(actor).map(s => s.up)).toEqual([3]);
  });
});

/* -------------------------------------------- */
/*  situational1: Earth Defense Command Benefits */
/* -------------------------------------------- */

describe('Earth Defense Command Benefits: ↑2 Driving an aerial vehicle', () => {
  const LABEL = 'Earth Defense Command Benefits (Driving an aerial vehicle)';
  const DRIVING = { rolledSkill: 'driving' };

  function crew({ role = 'driver', aerial = 60, type = 'vehicle' } = {}) {
    const holder = makeActor([packItem(FILES.earthDefense)]);
    makeActor([], { type, system: { movement: { aerial: { base: aerial, total: aerial } }, actors: { x: { uuid: holder.uuid, vehicleRole: role } } } });
    return holder;
  }

  test('the driver of a vehicle with Aerial Movement, on Driving only', () => {
    const holder = crew();
    expect(shifts(holder, DRIVING)).toEqual([{ label: LABEL, up: 2, edge: false }]);
    expect(shifts(holder, { rolledSkill: 'athletics' })).toEqual([]);
  });

  test('not a passenger, not a vehicle without Aerial Movement, not a Zord, not on foot', () => {
    expect(shifts(crew({ role: 'passenger' }), DRIVING)).toEqual([]);
    expect(shifts(crew({ aerial: 0 }), DRIVING)).toEqual([]);
    expect(shifts(crew({ type: 'zord' }), DRIVING)).toEqual([]);
    expect(shifts(makeActor([packItem(FILES.earthDefense)]), DRIVING)).toEqual([]);
  });

  test('a vehicle holding it, rolling its own Driving with Aerial Movement', () => {
    const flyer = makeActor([packItem(FILES.earthDefense)], { type: 'vehicle', system: { movement: { aerial: { base: 60, total: 60 } } } });
    expect(shifts(flyer, DRIVING)).toEqual([{ label: LABEL, up: 2, edge: false }]);
    const walker = makeActor([packItem(FILES.earthDefense)], { type: 'vehicle', system: { movement: { aerial: { base: 0, total: 0 } } } });
    expect(shifts(walker, DRIVING)).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  situational2: Forgiving                      */
/* -------------------------------------------- */

describe('Forgiving: Edge on Empathy against an aggressor', () => {
  const LABEL = 'Forgiving (Empathy against an aggressor)';
  const sword = () => packItem(null, { name: 'Slash', type: 'weaponEffect', system: { classification: { style: 'melee' } } });

  function setup() {
    const holder = makeActor([packItem(null, { name: 'Empathy', type: 'perk', source: EMPATHY, system: { choice: 'animalHandling' } }), packItem(FILES.forgiving)], { name: 'Kind' });
    const brute = makeActor([], { name: 'Brute', type: 'npc' });
    return { holder, brute };
  }

  // A roll by `actor` against `targets` (dice.mjs's post-roll hook, as target-riders.mjs calls it).
  const rollAgainst = (actor, targets, rider) => runPostRoll(actor, targets.map(() => ({ success: false })), {}, {
    hits: targets.map(target => ({ target, hit: false, result: { success: false } })), rider,
  });
  const empathy = (holder, target) => shifts(holder, { rolledSkill: 'animalHandling' }, target);

  test('an attack on the holder (hit or miss) is remembered; the holder\'s Empathy test against that attacker gets Edge', async () => {
    const { holder, brute } = setup();
    expect(empathy(holder, brute)).toEqual([]);
    const blade = sword();
    await rollAgainst(brute, [holder], { itemUuid: blade.uuid, skill: 'athletics', style: 'melee' });
    expect(empathy(holder, brute)).toEqual([{ label: LABEL, up: 0, edge: true }]);
    expect(empathy(holder, makeActor([], { type: 'npc' }))).toEqual([]);
    expect(shifts(holder, { rolledSkill: 'persuasion' }, brute)).toEqual([]);
  });

  test('an Intimidation test counts; another Skill Test does not', async () => {
    const { holder, brute } = setup();
    await rollAgainst(brute, [holder], { skill: 'persuasion' });
    expect(empathy(holder, brute)).toEqual([]);
    await rollAgainst(brute, [holder], { skill: 'intimidation' });
    expect(empathy(holder, brute)).toEqual([{ label: LABEL, up: 0, edge: true }]);
  });

  test('the Empathy test against them forgives them (hit or miss); a later aggression is remembered again', async () => {
    const { holder, brute } = setup();
    await rollAgainst(brute, [holder], { skill: 'intimidation' });
    await rollAgainst(holder, [brute], { skill: 'persuasion' });
    expect(empathy(holder, brute)).toHaveLength(1);
    await rollAgainst(holder, [brute], { skill: 'animalHandling' });
    expect(empathy(holder, brute)).toEqual([]);
    await rollAgainst(brute, [holder], { skill: 'intimidation' });
    await fireTriggers(holder, 'hit', { roll: { rolledSkill: 'animalHandling' }, targets: [brute] });
    expect(empathy(holder, brute)).toEqual([]);
  });

  test('two Forgiving holders keep their own records', async () => {
    const { holder, brute } = setup();
    const other = makeActor([packItem(null, { name: 'Empathy', type: 'perk', source: EMPATHY, system: { choice: 'animalHandling' } }), packItem(FILES.forgiving)], { name: 'Gentle' });
    await rollAgainst(brute, [holder, other], { skill: 'intimidation' });
    await rollAgainst(holder, [brute], { skill: 'animalHandling' });
    expect(empathy(holder, brute)).toEqual([]);
    expect(empathy(other, brute)).toEqual([{ label: LABEL, up: 0, edge: true }]);
  });

  test('a holder rolling against itself remembers nothing', async () => {
    const { holder } = setup();
    await rollAgainst(holder, [holder], { skill: 'intimidation' });
    expect(Object.keys(holder.flags.essence20.ruleMarks ?? {})).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  situational2: Plow                           */
/* -------------------------------------------- */

describe('Plow: a Ram\'s turn ignores Rough Terrain', () => {
  const ram = () => packItem(null, { name: 'Ram', type: 'weaponEffect', system: { isRam: true } });
  const roll = (actor, item) => runPostRoll(actor, [], {}, { hits: [], rider: { itemUuid: item.uuid, skill: 'athletics' } });
  const ignores = actor => !!ruleMovement(actor).ignoreRoughTerrain;

  test('in combat: for the turn the Ram was made in', async () => {
    const holder = makeActor([packItem(FILES.plow)]);
    game.combat = { id: 'c', started: true, round: 2, turn: 1, combatants: { contents: [] }, turns: [] };
    expect(ignores(holder)).toBe(false);
    await roll(holder, ram());
    expect(ignores(holder)).toBe(true);
    game.combat.turn = 2;
    expect(ignores(holder)).toBe(false);
  });

  test('not after another attack', async () => {
    const holder = makeActor([packItem(FILES.plow)]);
    await roll(holder, packItem(null, { name: 'Punch', type: 'weaponEffect', system: {} }));
    expect(ignores(holder)).toBe(false);
  });

  test('out of combat: until a combat starts', async () => {
    const holder = makeActor([packItem(FILES.plow)]);
    await roll(holder, ram());
    expect(ignores(holder)).toBe(true);
    game.combat = { id: 'c', started: true, round: 1, turn: 0, combatants: { contents: [] }, turns: [] };
    expect(ignores(holder)).toBe(false);
  });

  test('the vehicle its holder drives: the vehicle\'s Ram, the vehicle\'s movement', async () => {
    const driver = makeActor([packItem(FILES.plow)]);
    const truck = makeActor([], { type: 'vehicle', system: { actors: { d: { uuid: driver.uuid, vehicleRole: 'driver' } } } });
    const passengerOf = makeActor([], { type: 'vehicle', system: { actors: { d: { uuid: driver.uuid, vehicleRole: 'passenger' } } } });
    await roll(truck, ram());
    expect(ignores(truck)).toBe(true);
    expect(ignores(driver)).toBe(false);
    await roll(passengerOf, ram());
    expect(ignores(passengerOf)).toBe(false);
  });
});

/* -------------------------------------------- */
/*  gij1: Primal Fear (slC3's recorded differences) */
/* -------------------------------------------- */

describe('Primal Fear: nothing targeted costs nothing; each hunter keeps its own mark', () => {
  const FILE = 'ccitems/_source/Primal_Fear_xoD8fbVVqymTidNJ.json';
  const answers = (...list) => async () => list.shift() ?? null;
  const pay = () => jest.fn(async () => true);
  const up = (actor, other) => ruleRollSources(actor, other, { rolledSkill: 'athletics' }).sources.map(s => s.shiftUp);

  beforeAll(() => {
    registerCheck('environmentalExpertise', () => true);
  });

  function hunter() {
    const perk = packItem(FILE);
    const actor = makeActor([perk]);
    actor._dice = { rollSkill: jest.fn(async () => ({ success: true, outcomes: [{ results: [{ multiplier: 1 }] }] })) };
    return { actor, perk };
  }

  function foe() {
    const doc = makeActor([], { type: 'npc', name: 'Foe', system: { defenses: { willpower: { total: 14 }, cleverness: { total: 11 } } } });
    game.user.targets = new Set([{ actor: doc }]);
    return doc;
  }

  test('with nothing targeted the Free action is not paid', async () => {
    const { actor, perk } = hunter();
    const paid = pay();
    await runUse(perk, paid, { ask: answers(0) });
    expect(paid).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test('two hunters unnerving the same creature both keep their ↑1', async () => {
    const first = hunter();
    const second = hunter();
    const scared = foe();
    await runUse(first.perk, pay(), { ask: answers(0) });
    await runUse(second.perk, pay(), { ask: answers(1) });
    expect(up(first.actor, scared)).toEqual([1]);
    expect(up(second.actor, scared)).toEqual([1]);
  });
});
