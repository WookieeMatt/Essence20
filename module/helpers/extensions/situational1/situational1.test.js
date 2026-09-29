import { jest } from '@jest/globals';

beforeAll(() => {
  global.Hooks = { on: jest.fn(), once: jest.fn() };
  global.ui = { notifications: { warn: jest.fn() } };
});

const mod = await import('./situational1.mjs');
const {
  S1, deps, situationalRollSources, situationalToggles, situationalApplyDialog, situationalSpecializes, situationalDerived,
  isInJungle, urbanAdaptationMax, urbanAdaptationLeft, survivalSpecializationMatches, attireProtection, ignoresRoughTerrainS1,
  imposesRoughTerrainS1, onPreCreateEffect, fallDamage, splitIzunaDamage, skillSwapDelta, survivalRanks, lightArmorNoise,
  isAdaptedVehicleActive, situationalTurnStart,
} = mod;

const src = uuid => ({ core: { sourceId: uuid } });
const item = (uuid, extra = {}) => ({ id: extra.id ?? uuid.slice(-6), name: extra.name ?? 'Thing', type: extra.type ?? 'perk',
  system: extra.system ?? {}, flags: { ...src(uuid), essence20: extra.flags ?? {} } });
function actor(items = [], extra = {}) {
  const a = {
    id: extra.id ?? 'a1', uuid: extra.uuid ?? 'Actor.a1', name: 'A', type: extra.type ?? 'playerCharacter',
    system: extra.system ?? {}, flags: { essence20: extra.flags ?? {} }, statuses: new Set(extra.statuses ?? []),
    items: { contents: items, get: id => items.find(i => i.id == id) },
    documentName: 'Actor',
  };
  a.getFlag = (scope, key) => a.flags.essence20[key];
  a.setFlag = jest.fn(async (scope, key, value) => {
    a.flags.essence20[key] = value;
  });
  a.unsetFlag = jest.fn(async (scope, key) => {
    delete a.flags.essence20[key];
  });
  return a;
}

beforeEach(() => {
  global.game = {
    i18n: { localize: k => k, format: k => k }, user: { targets: new Set() }, actors: [], combat: null,
    settings: { get: () => 1 },
  };
  global.CONFIG = { E20: { skillShiftList: ['d12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'], actorReach: { common: 5 }, environments: {} } };
  deps.getEnvironment = () => 'normal';
  deps.getTerrain = () => null;
  deps.isInEnvironmentOfExpertise = () => null;
  deps.isEnvironmentalExpertiseActive = () => false;
  deps.getLedger = () => null;
});

const ids = out => out.sources.map(s => s.id);

test('Spacewalker: Edge on Athletics, ↑1 others in zero-G, +5 Evasion', () => {
  const holder = actor([item(S1.spacewalker)], { system: { defenses: { evasion: { total: 10, string: '10' } } } });
  deps.getEnvironment = () => 'zeroGravity';
  expect(situationalRollSources(holder, null, { rolledSkill: 'athletics' }).sources[0]).toMatchObject({ edge: true });
  expect(situationalRollSources(holder, null, { rolledSkill: 'science' }).sources[0]).toMatchObject({ shiftUp: 1 });
  situationalDerived(holder);
  expect(holder.system.defenses.evasion.total).toBe(15);
  deps.getEnvironment = () => 'lowGravity';
  expect(situationalRollSources(holder, null, { rolledSkill: 'science' }).sources).toEqual([]);
});

test('Environmental Warrior matches Survival specializations to the terrain', () => {
  const holder = actor([item(S1.environmentalWarrior)], { system: { skills: { survival: { specializations: { forests: { name: 'Forests' } } } } } });
  expect(survivalSpecializationMatches(holder)).toBe(null);
  expect(situationalToggles(holder, { item: { type: 'weaponEffect' } }).map(t => t.name)).toContain('s1EnvironmentalWarrior');
  deps.getTerrain = () => 'woodlands';
  expect(ids(situationalRollSources(holder, null, { item: { type: 'weaponEffect', system: {} } }))).toContain('s1-environmentalWarrior');
  deps.getTerrain = () => 'desert';
  expect(survivalSpecializationMatches(holder)).toBe(false);
});

test('Jungle Fighter: terrain, manual toggle, Out of the Jungle', () => {
  const holder = actor([item(S1.jungleFighter)]);
  expect(isInJungle(holder)).toBe(false);
  holder.flags.essence20.s1InJungle = true;
  expect(isInJungle(holder)).toBe(true);
  deps.getTerrain = () => 'desert';
  expect(isInJungle(holder)).toBe(false);
  deps.getTerrain = () => 'woodlands';
  expect(isInJungle(holder)).toBe(true);
  expect(ignoresRoughTerrainS1(holder)).toBe(true);
  expect(situationalSpecializes(holder, 'targeting', { type: 'weaponEffect' })).toBe(true);
  expect(situationalRollSources(holder, null, { rolledSkill: 'survival' }).sources[0].edge).toBe(true);
  deps.getTerrain = () => 'desert';
  expect(isInJungle(actor([item(S1.outOfTheJungle)]))).toBe(true);
});

test('Jungle Fighter hands back the light-armor noise on Infiltration', () => {
  const armor = item('x', { type: 'armor', system: { equipped: true, classification: 'light', traits: [], totalBonusToughness: 1, totalBonusEvasion: 0 } });
  const holder = actor([item(S1.outOfTheJungle), armor]);
  expect(lightArmorNoise(holder)).toBe(1);
  expect(situationalRollSources(holder, null, { rolledSkill: 'infiltration' }).sources.find(s => s.id == 's1-jungleFighterSilent').shiftUp).toBe(1);
});

test('Urban Adaptation pool and abilities', () => {
  const holder = actor([item(S1.urbanAdaptation)], { system: { level: 20 } });
  expect(urbanAdaptationMax(holder)).toBe(4);
  expect(urbanAdaptationMax(actor([], { system: { level: 10 } }))).toBe(2);
  holder.flags.essence20.s1UrbanAdaptationSpent = 3;
  expect(urbanAdaptationLeft(holder)).toBe(1);
  holder.flags.essence20.s1UrbanAdaptation = { epoch: 1, abilities: ['edge', 'roughTerrain'] };
  expect(situationalRollSources(holder, null, { rolledSkill: 'culture' }).sources[0].edge).toBe(true);
  expect(ignoresRoughTerrainS1(holder)).toBe(true);
  expect(situationalSpecializes(holder, 'targeting', { type: 'weaponEffect' })).toBe(false);
  deps.getTerrain = () => 'urban';
  expect(ignoresRoughTerrainS1(holder)).toBe(false);
});

test('Earth Defense Command Space Force', () => {
  const holder = actor([item(S1.earthDefenseCommand)]);
  deps.getEnvironment = () => 'zeroGravity';
  expect(situationalRollSources(holder, null, { item: { type: 'weaponEffect', system: {} } }).sources[0].shiftUp).toBe(2);
  const plane = { type: 'vehicle', system: { movement: { aerial: { total: 60 } }, actors: { x: { uuid: holder.uuid, vehicleRole: 'driver' } } } };
  global.game.actors = [plane];
  deps.getEnvironment = () => 'normal';
  expect(ids(situationalRollSources(holder, null, { rolledSkill: 'driving' }))).toContain('s1-spaceForceDriving');
});

test('Diver ↑1 Alertness underwater', () => {
  deps.getEnvironment = () => 'underwater';
  expect(situationalRollSources(actor([item(S1.diver)]), null, { rolledSkill: 'alertness' }).sources[0].shiftUp).toBe(1);
});

test('Weatherproof cancels the chosen environment penalty', () => {
  const weapon = { id: 'w', type: 'weapon', system: { traits: [] } };
  const upgrade = item(S1.weatherproof, { type: 'upgrade', flags: { parentId: 'w', s1Environment: 'underwater' } });
  const effect = { type: 'weaponEffect', system: { classification: { style: 'ranged' }, damageType: 'fire' }, flags: { essence20: { parentId: 'w' } } };
  const holder = actor([weapon, upgrade, effect]);
  deps.getEnvironment = () => 'underwater';
  const out = situationalRollSources(holder, null, { item: effect });
  expect(ids(out)).toEqual(expect.arrayContaining(['s1-weatherproofUnderwater', 's1-weatherproofUnderwaterFire']));
  deps.getEnvironment = () => 'vacuum';
  expect(situationalRollSources(holder, null, { item: effect }).sources).toEqual([]);
});

test('Every Trick cancels an invisible attacker, Thermal Scope sees one', () => {
  const effect = { type: 'weaponEffect', system: {}, flags: { essence20: { parentId: 'w' } } };
  const attacker = actor([{ id: 'w', type: 'weapon', system: {} }, item(S1.thermalScope, { type: 'upgrade', flags: { parentId: 'w' } }), effect], { statuses: ['invisible'] });
  const defender = actor([item(S1.everyTrick)], { id: 'd', statuses: ['invisible'] });
  const out = situationalRollSources(attacker, defender, { item: effect });
  expect(out.sources.find(s => s.id == 's1-everyTrick').snag).toBe(true);
  expect(out.sources.find(s => s.id == 's1-thermalScope').edge).toBe(true);
});

test('Environmental Enforcer: Edge on Maneuver attacks in a chosen terrain', () => {
  const holder = actor([item(S1.environmentalEnforcer, { flags: { s1Environments: ['arctic'] } })], { system: { skills: { survival: { shift: 'd4' } } } });
  const maneuver = { type: 'weaponEffect', system: { damageType: 'maneuver' } };
  expect(situationalToggles(holder, { item: maneuver }).map(t => t.name)).toContain('s1EnvironmentalEnforcer');
  deps.getTerrain = () => 'arctic';
  expect(ids(situationalRollSources(holder, null, { item: maneuver }))).toContain('s1-environmentalEnforcer');
  expect(survivalRanks(holder)).toBe(2);
});

test('dialog: Fast Tracking, Swerve, City Slicker and Layered Armor', async () => {
  const layered = item(S1.layeredArmor, { type: 'armor', system: { equipped: true } });
  const holder = actor([item(S1.swerve), item(S1.citySlicker), layered], {
    system: { skills: { infiltration: { shift: 'd20' }, streetwise: { shift: 'd6' } } },
  });
  expect(situationalToggles(holder, { rolledSkill: 'driving' }).map(t => t.name)).toEqual(['s1Swerve']);
  deps.getTerrain = () => 'urban';
  expect(situationalToggles(holder, { rolledSkill: 'infiltration' })[0]).toMatchObject({ name: 's1CitySlicker', value: true });
  expect(skillSwapDelta(holder, 'infiltration', 'streetwise')).toBe(3);
  const options = { shiftUp: 0, shiftDown: 0, ext: { s1Swerve: true, s1CitySlicker: true } };
  await situationalApplyDialog(holder, options, { rolledSkill: 'infiltration' });
  expect(options).toMatchObject({ edge: true, shiftUp: 3 });
  const persuade = { shiftUp: 0, ext: {} };
  await situationalApplyDialog(holder, persuade, { rolledSkill: 'persuasion', dataset: { specializationKey: 'leadership' } });
  expect(persuade.skillEffectModifierBonus).toBe(1);
});

test('Environmental Camouflage copies the armor bonus across', () => {
  const armor = { id: 'arm', type: 'armor', system: { equipped: true, totalBonusToughness: 2, totalBonusEvasion: 0 } };
  const camo = item(S1.environmentalCamouflage, { type: 'upgrade', flags: { parentId: 'arm', s1Environment: 'desert' } });
  const holder = actor([armor, camo], { system: { defenses: { evasion: { total: 10, string: '' }, toughness: { total: 12, string: '' } } } });
  deps.getTerrain = () => 'desert';
  situationalDerived(holder);
  expect(holder.system.defenses.evasion.total).toBe(12);
});

test('Weather Gear and Acclimating protect from temperature only', () => {
  const armor = { id: 'arm', type: 'armor', system: { equipped: true } };
  const gear = item(S1.weatherGear, { type: 'upgrade', name: 'Weather Gear', flags: { parentId: 'arm', s1Environment: 'extremeCold' } });
  const holder = actor([armor, gear]);
  expect(attireProtection(holder, 'extremeCold', { category: 'temperature' })).toBe('Weather Gear');
  expect(attireProtection(holder, 'extremeHeat', { category: 'temperature' })).toBe(null);
  expect(attireProtection(holder, 'vacuum', { category: 'breathing' })).toBe(null);
  const acc = actor([armor, item(S1.acclimating, { type: 'upgrade', name: 'Acc', flags: { parentId: 'arm' } })]);
  expect(attireProtection(acc, 'extremeHeat', { category: 'temperature' })).toBe('Acc');
});

test('Misguide imposes Rough Terrain on the stamped turn', async () => {
  const target = actor([], { flags: { s1Misguided: { combatId: 'c', pending: true } } });
  global.game.combat = { id: 'c', round: 2, turn: 3 };
  expect(imposesRoughTerrainS1({ actor: target })).toBe(false);
  await situationalTurnStart(target);
  expect(imposesRoughTerrainS1({ actor: target })).toBe(true);
});

test('Danger Sense and Every Trick block Surprised', () => {
  const holder = actor([item(S1.dangerSense)]);
  expect(onPreCreateEffect({ parent: holder, statuses: new Set(['surprised']) })).toBe(false);
  expect(onPreCreateEffect({ parent: holder, statuses: new Set(['prone']) })).toBe(true);
  expect(onPreCreateEffect({ parent: actor([]), statuses: new Set(['surprised']) })).toBe(true);
});

test('Adapted Vehicle follows its driver', () => {
  const driver = actor([item(S1.adaptedVehicle), item(S1.environmentalExpertise)], { uuid: 'Actor.d' });
  const vehicle = actor([], { type: 'vehicle', system: { actors: { x: { uuid: 'Actor.d', vehicleRole: 'driver' } } } });
  global.game.actors = [driver, vehicle];
  deps.getTerrain = () => 'arctic';
  deps.isInEnvironmentOfExpertise = () => true;
  expect(isAdaptedVehicleActive(vehicle)).toBe(true);
  expect(ignoresRoughTerrainS1(vehicle)).toBe(true);
  deps.isInEnvironmentOfExpertise = () => false;
  expect(isAdaptedVehicleActive(vehicle)).toBe(false);
});

test('falling damage for Izuna Drop', () => {
  expect(fallDamage(35)).toBe(3);
  expect(fallDamage(500)).toBe(20);
  expect(splitIzunaDamage(5, 3)).toEqual({ toTarget: 5, overflow: 2 });
  expect(splitIzunaDamage(2, 3)).toEqual({ toTarget: 2, overflow: 0 });
});
