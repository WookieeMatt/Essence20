import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuildIndex } from './index.mjs';
import { applyRuleSwitches, ruleDerived, ruleDialogSwitches, ruleMovement, ruleMovementStages, ruleRollSources, ruleSpecializes } from './adapter.mjs';
import { registerCheck, setWorldLookups } from './predicate.mjs';
import { useAvailable } from './triggers.mjs';
import { runSteps, stepContext } from './steps.mjs';
import { legacyChoiceUpdates } from './legacy-choices.mjs';
import { runPostRoll } from '../helpers/extensions.mjs';
import * as sit2 from '../helpers/extensions/situational2/common.mjs';

/**
 * Round 5 of the slC slices (gij1, gij2, gij3, fix3-gij, situational1, situational2): items moved from
 * hand-written code to item rules with the round-5 engine pieces (position checks, terrain:set,
 * environment:outside, @host, DerivedStat {choice} paths and booleans, Movement afterGravity,
 * anySucceeded). Each item is loaded from its pack source and must do what the removed code did.
 *
 * The position checks are registered here the way essence20.mjs registers them - on situational2's own
 * readings (helpers/extensions/situational2/common.mjs), fed by the same lookups.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const QG = id => `Compendium.essence20.quartermasters_guide_to_gear.Item.${id}`;

const FILES = {
  seafarer: 'qgtgitems/_source/Seafarer_vZjp9ncpzhgLIzSm.json',
  seafarerHangUp: 'qgtgitems/_source/Seafarer_ahWxUG3w6KkfgUDw.json',
  tritium: 'qgtgitems/_source/Tritium_Sights_dyNyzaagojOboB3y.json',
  rifle: 'qgtgitems/_source/Rifle__Tritium_Sight__zIyTgNkWkKUcWBSR.json',
  feetWet: 'qgtgitems/_source/Feet_Wet_7u3xCPPjxJlI7c61.json',
  shipShape: 'qgtgitems/_source/Ship_Shape_MejI6WIShcA0GdoW.json',
  sharksFin: 'qgtgitems/_source/Shark_s_Fin_c3tBbGzXDar3DA1E.json',
  amphibious: 'qgtgitems/_source/Amphibious_Assault_X2atZm3eoIBJcwF6.json',
  tracking: 'wtnvcgitems/_source/Tracking_Outfit_NHhNnkBBM29NpGpL.json',
  spacewalker: 'atsitems/_source/Spacewalker_OasmncqkxGO3QCXv.json',
  camouflage: 'fffav1items/_source/Environmental_Camouflage_SyHx2pheoELFpvTF.json',
  jungle: 'sssitems/_source/Jungle_Fighter_RWgIeFdT0c1vIcS1.json',
  seaLegs: 'ccitems/_source/Sea_Legs_mKsSa2HBOimHqS7i.json',
  extractPoison: 'ccitems/_source/Extract_Poison_0kcuvCeRhmneAJTl.json',
  mentor: 'gijcrbitems/_source/Mentor_jUZrNJbPzSd1zVLa.json',
  energyResistant: 'gijcrbitems/_source/Energy_Resistant_lKnjgN4TdHHNktpF.json',
  expertKnowledge: 'gijcrbitems/_source/Expert_Knowledge_9H78lRwXzJW6tj9e.json',
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

function makeActor(items, { system = {}, flags = {}, type = 'playerCharacter', token = null } = {}) {
  const actor = {
    id: `a${nextId++}`, name: 'Hero', type, isOwner: true, statuses: new Set(),
    flags: { essence20: { ...flags } },
    system: { level: 3, health: { value: 5, max: 10 }, ...system },
    getActiveTokens: () => (token ? [token] : []),
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.update = updater(actor);
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  items.forEach(item => (item.parent = actor));
  rebuildIndex(actor);
  return actor;
}

const attackOf = (weapon, extra = {}) => ({ id: `e${nextId++}`, name: extra.name ?? 'Shot', type: 'weaponEffect', system: { classification: { style: 'ranged' }, ...(extra.system ?? {}) }, flags: { essence20: { parentId: weapon?.id } } });
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
/*  situational2                                 */
/* -------------------------------------------- */

describe('Seafarer (swimming)', () => {
  test('Edge on Athletics in the water; out of it, an unticked switch that gives Edge', async () => {
    const actor = makeActor([packItem(FILES.seafarer)]);
    world.outside = 'underwater';
    expect(labels(edgeSources(actor, null, { rolledSkill: 'athletics' }))).toEqual(['Seafarer (swimming)']);
    expect(labels(ruleDialogSwitches(actor, { rolledSkill: 'athletics' }))).toEqual([]);
    expect(edgeSources(actor, null, { rolledSkill: 'culture' })).toEqual([]);
    expect(edgeSources(actor, null, { rolledSkill: 'athletics', dataset: { isInitiative: true } })).toEqual([]);

    world.outside = 'normal';
    expect(edgeSources(actor, null, { rolledSkill: 'athletics' })).toEqual([]);
    const [swim] = ruleDialogSwitches(actor, { rolledSkill: 'athletics' });
    expect(swim).toMatchObject({ label: 'Swimming (Seafarer: Edge)', value: false });
    actor.flags.essence20.ruleSwitches = { [swim.name]: true };
    expect(ruleDialogSwitches(actor, { rolledSkill: 'athletics' })[0].value).toBe(false);
    const options = { ext: { [swim.name]: true } };
    await applyRuleSwitches(actor, options, { rolledSkill: 'athletics' });
    expect(options.edge).toBe(true);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'brawn' })).toEqual([]);
  });
});

describe('Seafarer (Hang-Up)', () => {
  function sailor(extra = {}) {
    return makeActor([packItem(FILES.seafarerHangUp, extra)]);
  }

  test('a poison or illness attack gains Edge against the holder on land', () => {
    const holder = sailor();
    const attacker = makeActor([]);
    const venom = { type: 'weaponEffect', name: 'Venom Bite', system: { damageType: 'sharp' }, flags: {} };
    expect(labels(edgeSources(attacker, holder, { item: venom }))).toEqual(['Poison or illness against a Seafarer on land (Edge)']);
    expect(edgeSources(attacker, holder, { item: { type: 'weaponEffect', name: 'Gas', system: { damageType: 'poison' }, flags: {} } })).toHaveLength(1);
    expect(edgeSources(attacker, holder, { item: { type: 'spell', name: 'Plague Touch', system: {}, flags: {} } })).toHaveLength(1);
    expect(edgeSources(attacker, holder, { item: { type: 'weaponEffect', name: 'Shot', system: { damageType: 'sharp' }, flags: {} } })).toEqual([]);
    expect(edgeSources(attacker, holder, {})).toEqual([]);
    expect(edgeSources(attacker, null, { item: venom })).toEqual([]);
  });

  test('a weapon carrying poison, or named for one, counts too', () => {
    const holder = sailor();
    const dart = { id: 'w1', name: 'Dart Gun', type: 'weapon', system: { isPoison: true }, flags: {} };
    const blowgun = { id: 'w2', name: 'Toxin Blowgun', type: 'weapon', system: {}, flags: {} };
    const pistol = { id: 'w3', name: 'Pistol', type: 'weapon', system: {}, flags: {} };
    const attacker = makeActor([dart, blowgun, pistol]);
    for (const weapon of [dart, blowgun]) {
      const effect = attackOf(weapon);
      effect.parent = attacker;
      expect(edgeSources(attacker, holder, { item: effect })).toHaveLength(1);
    }

    const shot = attackOf(pistol);
    shot.parent = attacker;
    expect(edgeSources(attacker, holder, { item: shot })).toEqual([]);
  });

  test('not at sea, in the water or aboard an aquatic vessel; not while Matured-ignored', () => {
    const venom = { type: 'weaponEffect', name: 'Venom Bite', system: {}, flags: {} };
    const holder = sailor();
    const attacker = makeActor([]);
    world.terrain = 'sea';
    expect(edgeSources(attacker, holder, { item: venom })).toEqual([]);
    world.terrain = null;
    world.outside = 'underwater';
    expect(edgeSources(attacker, holder, { item: venom })).toEqual([]);
    world.outside = 'normal';
    game.actors.contents = [{ type: 'vehicle', system: { actors: { x: { uuid: holder.uuid, vehicleRole: 'passenger' } }, movement: { swim: { base: 30 } } } }];
    expect(edgeSources(attacker, holder, { item: venom })).toEqual([]);
    game.actors.contents = [];
    expect(edgeSources(attacker, sailor({ flags: { maturedIgnored: true } }), { item: venom })).toEqual([]);
  });
});

describe('Tritium Sights', () => {
  function sniper(darknessLevel) {
    const scene = { id: 's', name: 'Night', environment: { darknessLevel }, tokens: [] };
    const rifle = { id: 'w1', name: 'Rifle', type: 'weapon', system: { equipped: true }, flags: {} };
    const pistol = { id: 'w2', name: 'Pistol', type: 'weapon', system: { equipped: true }, flags: {} };
    const sights = packItem(FILES.tritium, { flags: { parentId: 'w1' } });
    const actor = makeActor([rifle, pistol, sights], { token: { parent: scene } });
    return { actor, shot: attackOf(rifle), other: attackOf(pistol) };
  }

  test('in complete darkness the ↑1 switch starts ticked; when the scene can\'t tell, unticked', async () => {
    const dark = sniper(1);
    const [tritium] = ruleDialogSwitches(dark.actor, { item: dark.shot });
    expect(tritium).toMatchObject({ label: 'Complete darkness (Tritium Sights: ↑1)', value: true });
    const options = { ext: { [tritium.name]: true } };
    await applyRuleSwitches(dark.actor, options, { item: dark.shot });
    expect(options.shiftUp).toBe(1);

    const dim = sniper(0.3);
    dim.actor.flags.essence20.ruleSwitches = { [tritium.name]: true };
    expect(ruleDialogSwitches(dim.actor, { item: dim.shot })).toMatchObject([{ value: false }]);
    expect(ruleRollSources(dim.actor, null, { item: dim.shot }).sources).toEqual([]);
  });

  test('only on the attacks of the weapon it is attached to', () => {
    const { actor, other } = sniper(1);
    expect(ruleDialogSwitches(actor, { item: other })).toEqual([]);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'alertness' })).toEqual([]);
  });

  test('the pre-built Rifle (Tritium Sight) brings its own Tritium Sights upgrade', () => {
    const entries = Object.values(fromPack(FILES.rifle).system.items);
    expect(entries).toContainEqual(expect.objectContaining({ type: 'upgrade', uuid: QG('dyNyzaagojOboB3y') }));
  });
});

describe('Feet Wet and Ship Shape', () => {
  const FEET_WET = QG('7u3xCPPjxJlI7c61');
  const effect = { type: 'weaponEffect', name: 'Cutlass', system: {}, flags: {} };

  function sailor({ shipShape = false } = {}) {
    const items = [packItem(FILES.feetWet, { source: FEET_WET })];
    if (shipShape) {
      items.push(packItem(FILES.shipShape, { source: QG('MejI6WIShcA0GdoW') }));
    }

    return makeActor(items);
  }

  const active = actor => ({
    edge: edgeSources(actor, null, { rolledSkill: 'alertness' }).length,
    attackEdge: edgeSources(actor, null, { item: effect }).length,
    specialized: ruleSpecializes(actor, 'targeting', effect),
    rough: ruleMovement(actor).ignoreRoughTerrain,
  });

  test('at sea: Edge on non-combat tests, Specialized attacks, no Rough Terrain', () => {
    const actor = sailor();
    world.terrain = 'sea';
    expect(active(actor)).toEqual({ edge: 1, attackEdge: 0, specialized: true, rough: true });
    expect(edgeSources(actor, null, { rolledSkill: 'alertness', dataset: { isInitiative: true } })).toEqual([]);
    expect(ruleSpecializes(actor, 'alertness', null)).toBe(false);
  });

  test('aboard an aquatic vessel, once; nothing elsewhere, and nothing asked on an untagged scene', () => {
    const actor = sailor();
    expect(active(actor)).toEqual({ edge: 0, attackEdge: 0, specialized: false, rough: false });
    expect(ruleDialogSwitches(actor, { rolledSkill: 'alertness' })).toEqual([]);
    expect(ruleDialogSwitches(actor, { item: effect })).toEqual([]);
    game.actors.contents = [{ type: 'vehicle', system: { actors: { x: { uuid: actor.uuid, vehicleRole: 'passenger' } }, movement: { swim: { base: 30 } } } }];
    expect(active(actor)).toEqual({ edge: 1, attackEdge: 0, specialized: true, rough: true });
    world.terrain = 'sea';
    expect(active(actor)).toEqual({ edge: 1, attackEdge: 0, specialized: true, rough: true });
    world.terrain = 'urban';
    expect(active(actor).edge).toBe(1);
    game.actors.contents = [{ type: 'vehicle', system: { actors: { x: { uuid: actor.uuid, vehicleRole: 'passenger' } }, movement: { ground: { base: 30 }, swim: { base: 0 } } } }];
    expect(active(actor)).toEqual({ edge: 0, attackEdge: 0, specialized: false, rough: false });
  });

  test('Ship Shape adds wetlands, for a Feet Wet holder only', () => {
    world.terrain = 'wetlands';
    expect(active(sailor())).toEqual({ edge: 0, attackEdge: 0, specialized: false, rough: false });
    expect(active(sailor({ shipShape: true }))).toEqual({ edge: 1, attackEdge: 0, specialized: true, rough: true });
    const shapeOnly = makeActor([packItem(FILES.shipShape)]);
    expect(active(shapeOnly)).toEqual({ edge: 0, attackEdge: 0, specialized: false, rough: false });
    const both = sailor({ shipShape: true });
    game.actors.contents = [{ type: 'vehicle', system: { actors: { x: { uuid: both.uuid, vehicleRole: 'driver' } }, movement: { swim: { base: 30 } } } }];
    expect(active(both).edge).toBe(1);
  });

  test('Ship Shape: an aquatic vehicle its holder drives gets Feet Wet anywhere', () => {
    const driver = makeActor([packItem(FILES.shipShape)]);
    global.fromUuidSync = uuid => (uuid == driver.uuid ? driver : null);
    const vehicle = (role, swim) => makeActor([], { type: 'vehicle', system: { actors: { d: { uuid: driver.uuid, vehicleRole: role } }, movement: { swim: { base: swim, total: swim } } } });
    expect(active(vehicle('driver', 50))).toEqual({ edge: 1, attackEdge: 0, specialized: true, rough: true });
    expect(labels(edgeSources(vehicle('driver', 50), null, { rolledSkill: 'driving' }))).toEqual(['Feet Wet (Ship Shape: the aquatic vehicle you drive, non-combat tests)']);
    expect(active(vehicle('driver', 0))).toEqual({ edge: 0, attackEdge: 0, specialized: false, rough: false });
    expect(active(vehicle('gunner', 50))).toEqual({ edge: 0, attackEdge: 0, specialized: false, rough: false });
    expect(active(driver)).toEqual({ edge: 0, attackEdge: 0, specialized: false, rough: false });
  });
});

describe('Shark\'s Fin and Sea Legs (Movement after gravity)', () => {
  const swimmer = (files, movement) => makeActor(files.map(file => packItem(file)), { system: { movement } });

  // Shark's Fin moved to stage afterDerived in round 6 - its tests are in conv6-slC6.test.js.
  test('Sea Legs: 30 with no Aquatic Movement, +15 on top of one', () => {
    const dry = swimmer([FILES.seaLegs], { swim: { total: 0 } });
    expect(ruleMovementStages(dry)('afterGravity', 'swim', 0)).toBe(30);
    const wet = swimmer([FILES.seaLegs, FILES.seaLegs], { swim: { total: 20 } });
    expect(ruleMovementStages(wet)('afterGravity', 'swim', 20)).toBe(35);
    expect(ruleMovementStages(wet)('afterGravity', 'ground', 20)).toBe(null);
  });
});

describe('Initiative halves: Amphibious Assault and Tracking Outfit', () => {
  const initiative = { rolledSkill: 'initiative', dataset: { isInitiative: true } };
  const ups = (actor, ctx = initiative) => ruleRollSources(actor, null, ctx).sources.filter(source => source.shiftUp).map(source => [source.label, source.shiftUp]);

  test('Amphibious Assault: ↑1 on Initiative in the water', () => {
    const actor = makeActor([packItem(FILES.amphibious)], { system: { movement: { swim: { base: 0 }, ground: { total: 30 } } } });
    world.outside = 'underwater';
    expect(ups(actor)).toEqual([['Initiative in the water (Amphibious Assault: ↑1)', 1]]);
    expect(ups(actor, { rolledSkill: 'athletics' })).toEqual([]);
    world.outside = 'normal';
    expect(ups(actor)).toEqual([]);
    expect(ruleDialogSwitches(actor, initiative)).toEqual([]);
  });

  test('Tracking Outfit: ↑1 on Initiative in the wild (worn, terrain set)', () => {
    const outfit = packItem(FILES.tracking, { system: { equipped: true } });
    const actor = makeActor([outfit]);
    world.terrain = 'woodlands';
    expect(ups(actor)).toEqual([['Initiative in the wild (Tracking Outfit: ↑1)', 1]]);
    world.terrain = 'urban';
    expect(ups(actor)).toEqual([]);
    world.terrain = null;
    expect(ups(actor)).toEqual([]);
    expect(labels(ruleDialogSwitches(actor, initiative))).not.toContain('Initiative in the wild (Tracking Outfit: ↑1)');
    world.terrain = 'desert';
    outfit.system.equipped = false;
    rebuildIndex(actor);
    expect(ups(actor)).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  situational1                                 */
/* -------------------------------------------- */

describe('Spacewalker', () => {
  const walker = () => makeActor([packItem(FILES.spacewalker)], { system: { defenses: { evasion: { total: 10, string: '10' } } } });

  test('+5 Evasion in low or zero gravity, not counting a vessel interior', () => {
    for (const outside of ['zeroGravity', 'lowGravity']) {
      const actor = walker();
      world.outside = outside;
      ruleDerived(actor);
      expect(actor.system.defenses.evasion).toEqual({ total: 15, string: '10 + 5 (Spacewalker)' });
    }

    const inside = walker();
    world.outside = 'normal';
    world.environment = 'zeroGravity';
    ruleDerived(inside);
    expect(inside.system.defenses.evasion.total).toBe(10);
  });
});

describe('Environmental Camouflage', () => {
  function ranger({ environment = 'desert', equipped = true, isPowerArmor = false, toggle = null, type = 'playerCharacter', morphed = false, flags = null } = {}) {
    const armor = { id: `arm${nextId++}`, name: 'Battledress', type: 'armor', flags: {}, system: { equipped, isPowerArmor, totalBonusToughness: 2, totalBonusEvasion: 1 } };
    const rules = { ...(environment ? { choices: { environment } } : {}), ...(toggle === null ? {} : { toggles: { inEnvironment: toggle } }) };
    const camo = packItem(FILES.camouflage, { flags: { parentId: armor.id, rules, ...(flags ?? {}) } });
    const actor = makeActor([armor, camo], { type, system: { isMorphed: morphed, defenses: { evasion: { total: 10, string: '10' }, toughness: { total: 12, string: '12' } } } });
    return { actor, camo, armor };
  }

  const defenses = actor => {
    ruleDerived(actor);
    return [actor.system.defenses.evasion.total, actor.system.defenses.toughness.total];
  };

  test('in the chosen terrain the armor\'s bonuses cross over to Evasion and Toughness', () => {
    world.terrain = 'desert';
    const { actor } = ranger();
    expect(defenses(actor)).toEqual([12, 13]);
    expect(actor.system.defenses.evasion.string).toBe('10 + 2 (Environmental Camouflage)');
    world.terrain = 'arctic';
    expect(defenses(ranger({ toggle: true }).actor)).toEqual([10, 12]);
  });

  test('on a scene with no terrain set, the toggle says so', () => {
    expect(defenses(ranger().actor)).toEqual([10, 12]);
    expect(defenses(ranger({ toggle: true }).actor)).toEqual([12, 13]);
    expect(defenses(ranger({ toggle: true, environment: null }).actor)).toEqual([10, 12]);
  });

  test('not for Power Armor, unworn armor, a Morphed character or a non-player character', () => {
    world.terrain = 'desert';
    for (const options of [{ isPowerArmor: true }, { equipped: false }, { morphed: true }, { type: 'npc' }, { environment: null }]) {
      expect(defenses(ranger(options).actor)).toEqual([10, 12]);
    }
  });

  test('the Uses: choose the environment, and toggle it on an untagged scene; an old pick and toggle are kept', async () => {
    const { actor, camo } = ranger({ environment: null });
    const rules = camo.system.rules;
    const choose = rules.find(rule => rule.label == 'Choose the environment');
    const ctx = stepContext({ actor, item: camo, rule: choose, targets: [] });
    ctx.askPick = async (step, options) => {
      expect(options.map(option => option.value)).toEqual(['arctic', 'desert', 'grasslands', 'mountains', 'sea', 'urban', 'wetlands', 'woodlands']);
      return 'sea';
    };

    await runSteps(choose.steps, ctx);
    expect(camo.flags.essence20.rules.choices.environment).toBe('sea');

    const flip = rules.find(rule => rule.label.startsWith('In or out'));
    const index = rules.indexOf(flip);
    expect(useAvailable(camo, flip, index)).toBe(true);
    const run = stepContext({ actor, item: camo, rule: flip, targets: [] });
    await runSteps(flip.steps, run);
    expect(camo.flags.essence20.rules.toggles.inEnvironment).toBe(true);
    expect(run.chat.join(' ')).toContain('Hero is in the chosen environment');
    world.terrain = 'urban';
    expect(useAvailable(camo, flip, index)).toBe(false);

    const old = ranger({ environment: null, flags: { s1Environment: 'arctic', s1InEnvironmentNow: true } });
    expect(legacyChoiceUpdates(old.actor)).toEqual([{
      _id: old.camo.id, 'flags.essence20.rules.choices.environment': 'arctic', 'flags.essence20.rules.toggles.inEnvironment': true,
    }]);
  });
});

describe('Jungle Fighter', () => {
  const effect = { type: 'weaponEffect', name: 'Machete', system: {}, flags: {} };
  function fighter(toggle = null) {
    const perk = packItem(FILES.jungle, { flags: toggle === null ? {} : { rules: { toggles: { inJungle: toggle } } } });
    return { actor: makeActor([perk]), perk };
  }

  const active = actor => ({
    edge: edgeSources(actor, null, { rolledSkill: 'survival' }).length,
    attackEdge: edgeSources(actor, null, { item: effect }).length,
    specialized: ruleSpecializes(actor, 'targeting', effect),
    rough: ruleMovement(actor).ignoreRoughTerrain,
  });

  test('in the jungle: Edge on non-attack tests, Specialized attacks, no Rough Terrain', () => {
    world.terrain = 'woodlands';
    expect(active(fighter().actor)).toEqual({ edge: 1, attackEdge: 0, specialized: true, rough: true });
    expect(edgeSources(fighter().actor, null, { rolledSkill: 'survival', dataset: { isInitiative: true } })).toEqual([]);
    world.terrain = 'desert';
    expect(active(fighter(true).actor)).toEqual({ edge: 0, attackEdge: 0, specialized: false, rough: false });
  });

  test('on a scene with no terrain set, the toggle (the Use) says so; nothing is asked', async () => {
    const { actor, perk } = fighter();
    expect(active(actor)).toEqual({ edge: 0, attackEdge: 0, specialized: false, rough: false });
    expect(ruleDialogSwitches(actor, { rolledSkill: 'survival' })).toEqual([]);
    const use = perk.system.rules.find(rule => rule.type == 'Use');
    const index = perk.system.rules.indexOf(use);
    expect(useAvailable(perk, use, index)).toBe(true);
    const ctx = stepContext({ actor, item: perk, rule: use, targets: [] });
    await runSteps(use.steps, ctx);
    expect(ctx.chat).toContain('{name} is in the jungle.'.replace('{name}', 'Hero'));
    expect(active(actor)).toEqual({ edge: 1, attackEdge: 0, specialized: true, rough: true });
    world.terrain = 'urban';
    expect(useAvailable(perk, use, index)).toBe(false);
  });

  test('an old "in the jungle" actor flag moves into the toggle', () => {
    const perk = packItem(FILES.jungle);
    const actor = makeActor([perk], { flags: { s1InJungle: true } });
    expect(legacyChoiceUpdates(actor)).toEqual([{ _id: perk.id, 'flags.essence20.rules.toggles.inJungle': true }]);
  });
});

/* -------------------------------------------- */
/*  gij1 / gij2                                  */
/* -------------------------------------------- */

describe('Extract Poison', () => {
  test('Qualified (and trained) in all poisons', () => {
    const actor = makeActor([packItem(FILES.extractPoison)], { system: { qualified: { poisons: {} }, trained: { poisons: {} } } });
    ruleDerived(actor);
    expect(actor.system.qualified.poisons).toEqual({ all: true, standard: true, limited: true });
    expect(actor.system.trained.poisons).toEqual({ all: true, standard: true, limited: true });
    const untracked = makeActor([packItem(FILES.extractPoison)], { system: { qualified: { poisons: {} } } });
    ruleDerived(untracked);
    expect(untracked.system.trained).toBeUndefined();
    const none = makeActor([packItem(FILES.extractPoison)], { system: { trained: { poisons: {} } } });
    ruleDerived(none);
    expect(none.system.trained.poisons).toEqual({});
    expect(none.system.qualified).toBeUndefined();
  });
});

describe('Mentor', () => {
  const skills = { might: { essences: { strength: true } }, alertness: { essences: { smarts: true } }, spellcasting: { essences: {} } };

  test('the chosen Essence can improve the chosen Skill; nothing before both are picked', () => {
    const picked = makeActor([packItem(FILES.mentor, { flags: { rules: { choices: { skill: 'might', essence: 'social' } } } })], { system: { skills: JSON.parse(JSON.stringify(skills)) } });
    ruleDerived(picked);
    expect(picked.system.skills.might.essences).toEqual({ strength: true, social: true });
    const half = makeActor([packItem(FILES.mentor, { flags: { rules: { choices: { skill: 'might' } } } })], { system: { skills: JSON.parse(JSON.stringify(skills)) } });
    ruleDerived(half);
    expect(half.system.skills.might.essences).toEqual({ strength: true });
  });

  test('the pick offers every Essence but the Skill\'s own; asked when added and by the Use', async () => {
    const mentor = packItem(FILES.mentor);
    const actor = makeActor([mentor], { system: { skills: JSON.parse(JSON.stringify(skills)) } });
    const use = mentor.system.rules.find(rule => rule.type == 'Use');
    const added = mentor.system.rules.find(rule => rule.type == 'Trigger');
    expect(added.event).toBe('added');
    expect(added.steps).toEqual(use.steps);

    for (const [skill, offered] of [['might', ['speed', 'smarts', 'social']], ['alertness', ['strength', 'speed', 'social']], ['spellcasting', ['strength', 'speed', 'smarts', 'social']]]) {
      const ctx = stepContext({ actor, item: mentor, rule: use, targets: [] });
      const asked = [];
      ctx.askPick = async (step, options) => {
        asked.push(options.map(option => option.value));
        return step.key == 'skill' ? skill : options.at(-1).value;
      };

      expect(await runSteps(use.steps, ctx)).toBe(true);
      expect(asked).toEqual([['might', 'alertness', 'spellcasting'], offered]);
      expect(mentor.flags.essence20.rules.choices).toEqual({ skill, essence: offered.at(-1) });
    }
  });

  test('an old pick is kept', () => {
    const mentor = packItem(FILES.mentor, { flags: { gij2Mentor: { skill: 'might', essence: 'social' } } });
    const actor = makeActor([mentor]);
    expect(legacyChoiceUpdates(actor)).toEqual([{ _id: mentor.id, 'flags.essence20.rules.choices.skill': 'might', 'flags.essence20.rules.choices.essence': 'social' }]);
  });
});

describe('re-checked conversions', () => {
  test('Energy Resistant: one rule now, and the Resistance is a plain true', () => {
    const upgrade = packItem(FILES.energyResistant, { flags: { rules: { choices: { element: 'laser' } } } });
    expect(upgrade.system.rules.filter(rule => rule.type == 'DerivedStat')).toHaveLength(1);
    const actor = makeActor([upgrade], { system: { resistances: { laser: false, fire: false } } });
    ruleDerived(actor);
    expect(actor.system.resistances).toEqual({ laser: true, fire: false });
  });

  test('Expert Knowledge: a Critical Success that still missed the DIF notes nothing', async () => {
    const perk = packItem(FILES.expertKnowledge, { flags: { rules: { choices: { skill: 'science' } } } });
    const actor = makeActor([perk]);
    const rolled = async (results, extra) => {
      global.ChatMessage.create.mockClear();
      await runPostRoll(actor, results, { riderContext: { skill: 'science' } }, { hits: [], rider: { skill: 'science' }, ...extra });
      return global.ChatMessage.create.mock.calls.map(([data]) => data.content).join('\n');
    };

    expect(await rolled([{ success: false, multiplier: 0 }], { isCrit: true })).toBe('');
    expect(await rolled([{ success: true, multiplier: 1 }], { isCrit: true })).toContain('2 additional benefits');
  });
});
