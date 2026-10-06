import { jest } from '@jest/globals';

beforeAll(() => {
  global.Hooks = { on: jest.fn(), once: jest.fn() };
  global.ui = { notifications: { warn: jest.fn() } };
});

// The terrain / environment Perks of the situational slice 1, one file each now; the combined readers below
// stand for what the registry sees (every roll source in turn, any ignorer, any specializer).
const { S1, deps } = await import('../shared/terrain-perk-ids-and-readers.mjs');
const urban = await import('../rolls/urban-adaptation.mjs');
const adapted = await import('../vehicles/adapted-vehicles.mjs');
const { fallDamage, splitIzunaDamage } = await import('../attacks/izuna-drop.mjs');
await import('../gear/earth-defense-command-space-kit.mjs');
const enforcer = await import('../attacks/environmental-enforcer.mjs');
const { urbanAdaptationMax, urbanAdaptationLeft, skillSwapDelta } = urban;
const { isAdaptedVehicleActive } = adapted;
const { survivalRanks } = enforcer;
const situationalRollSources = (a, t, ctx) => ({ sources: [
  ...urban.urbanAdaptationRollSources(a, t, ctx).sources,
  ...adapted.adaptedVehicleRollSources(a, t, ctx).sources,
  ...enforcer.environmentalEnforcerRollSources(a, t, ctx).sources,
], consumes: [] });
const situationalToggles = enforcer.environmentalEnforcerToggles;
const situationalApplyDialog = enforcer.environmentalEnforcerApplyDialog;
const situationalSpecializes = (a, skill, item) => urban.urbanAdaptationSpecializes(a, skill, item) || adapted.adaptedVehicleSpecializes(a, skill, item);
const ignoresRoughTerrainS1 = a => urban.urbanAdaptationIgnoresRoughTerrain(a) || adapted.adaptedVehicleIgnoresRoughTerrain(a);

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
});

const ids = out => out.sources.map(s => s.id);

test('Jungle Fighter and Out of the Jungle add nothing here (item rules - conv5-slC5 / conv8-slC8)', () => {
  const JUNGLE = 'Compendium.essence20.sgt_slaughter_sourcebook.Item.RWgIeFdT0c1vIcS1';
  const OUT = 'Compendium.essence20.sgt_slaughter_sourcebook.Item.5jc5fjieruLuWQm1';
  const armor = item('x', { type: 'armor', system: { equipped: true, classification: 'light', traits: [], totalBonusToughness: 1, totalBonusEvasion: 0 } });
  deps.getTerrain = () => 'woodlands';
  const holder = actor([item(JUNGLE), item(OUT), armor]);
  expect(ignoresRoughTerrainS1(holder)).toBe(false);
  expect(situationalSpecializes(holder, 'targeting', { type: 'weaponEffect' })).toBe(false);
  expect(situationalRollSources(holder, null, { rolledSkill: 'infiltration' }).sources).toEqual([]);
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

test('Earth Defense Command Space Force: the Driving ↑2 is an item rule now (rules/conv8-slC8.test.js)', () => {
  const holder = actor([item(S1.earthDefenseCommand)]);
  const plane = { type: 'vehicle', system: { movement: { aerial: { total: 60 } }, actors: { x: { uuid: holder.uuid, vehicleRole: 'driver' } } } };
  global.game.actors = [plane];
  expect(situationalRollSources(holder, null, { rolledSkill: 'driving' }).sources).toEqual([]);
});

test('Environmental Enforcer: Edge on Maneuver attacks in a chosen terrain', () => {
  const holder = actor([item(S1.environmentalEnforcer, { flags: { s1Environments: ['arctic'] } })], { system: { skills: { survival: { shift: 'd4' } } } });
  const maneuver = { type: 'weaponEffect', system: { damageType: 'maneuver' } };
  expect(situationalToggles(holder, { item: maneuver }).map(t => t.name)).toContain('s1EnvironmentalEnforcer');
  deps.getTerrain = () => 'arctic';
  expect(ids(situationalRollSources(holder, null, { item: maneuver }))).toContain('s1-environmentalEnforcer');
  expect(survivalRanks(holder)).toBe(2);
});

test('dialog: nothing of its own here (City Slicker, Fast Tracking and Layered Armor are rules now)', async () => {
  const holder = actor([], {
    system: { skills: { infiltration: { shift: 'd20' }, streetwise: { shift: 'd6' } } },
  });
  expect(situationalToggles(holder, { rolledSkill: 'driving' })).toEqual([]);
  deps.getTerrain = () => 'urban';
  expect(situationalToggles(holder, { rolledSkill: 'infiltration' })).toEqual([]);
  expect(skillSwapDelta(holder, 'infiltration', 'streetwise')).toBe(3);
  const persuade = { shiftUp: 0, ext: {} };
  await situationalApplyDialog(holder, persuade, { rolledSkill: 'persuasion', dataset: { specializationKey: 'leadership' } });
  expect(persuade.skillEffectModifierBonus).toBeUndefined();
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
