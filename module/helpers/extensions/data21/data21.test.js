import { jest } from '@jest/globals';

global.Hooks = { on: jest.fn() };

const { D21 } = await import('./common.mjs');
const { finesseOrMight, psychoRiderOf, halveMovementDerived, HALVE_KIND } = await import('./weapons.mjs');
const { kitWeaponsFor, KIT_WEAPONS, ALL_PSYCHO_WEAPONS } = await import('./psycho.mjs');
const { droneDefenseBonus, applyDroneDefenses, skyMorpherSources } = await import('./gear.mjs');
const { compassionateToggles, compassionateApply, healOne } = await import('./compassionate.mjs');
const { largerThanLifeReach, isNonMystical, mysticSources, mysticDefense } = await import('./threats.mjs');
const { officerTrainingUpdate } = await import('./officer.mjs');

const sourced = (uuid, extra = {}) => ({ id: extra.id ?? uuid.slice(-5), name: extra.name ?? 'Item', type: extra.type ?? 'perk', system: extra.system ?? {}, flags: { core: { sourceId: uuid }, essence20: extra.flags ?? {} } });
const actor = (items = [], extra = {}) => ({
  uuid: extra.uuid ?? 'Actor.a', name: extra.name ?? 'A', type: extra.type ?? 'playerCharacter',
  system: extra.system ?? {}, flags: { essence20: extra.flags ?? {} }, items: { contents: items, get: id => items.find(i => i.id == id) },
  update: jest.fn(), statuses: new Set(),
});

beforeEach(() => {
  global.game = { i18n: { localize: k => k, format: k => k }, user: { id: 'u1', targets: new Set() }, actors: [], combat: null, settings: { get: () => 0 } };
  global.CONFIG = {
    E20: {
      skillShiftList: ['d12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'],
      skillToEssence: { finesse: 'speed', might: 'strength' },
      actorReach: { small: 2, common: 5, large: 5 },
    },
  };
});

test('Finesse or Might rolls the better Skill', () => {
  const pc = actor([], { system: { skills: { finesse: { shift: 'd4' }, might: { shift: 'd8' } } } });
  const dataset = { skill: 'finesse', essence: 'speed', shift: 'd4' };
  expect(finesseOrMight(pc, dataset, sourced(D21.ironClawEffects[0], { type: 'weaponEffect' }))).toBe('might');
  expect(dataset).toMatchObject({ skill: 'might', essence: 'strength', shift: 'd8' });

  const other = { skill: 'finesse', essence: 'speed' };
  expect(finesseOrMight(pc, other, sourced('Compendium.x.y.Item.z', { type: 'weaponEffect' }))).toBeNull();
  expect(other.skill).toBe('finesse');
});

test('Psycho alternate riders read their flags', () => {
  expect(psychoRiderOf({ flags: { essence20: { d21Shove: 10 } } })).toEqual({ kind: 'shove', feet: 10 });
  expect(psychoRiderOf({ flags: { essence20: { d21HalveMovement: true } } }).kind).toBe('halve');
  expect(psychoRiderOf({ flags: { essence20: { d21Disarm: true } } }).kind).toBe('disarm');
  expect(psychoRiderOf({ flags: {} })).toBeNull();
});

test('halved Movement rounds up while the mark lasts', () => {
  const target = actor([], { flags: { riderMarks: [{ kind: HALVE_KIND, by: 'x' }] }, system: { movement: { ground: { total: 25 }, aerial: { total: 0 } } } });
  halveMovementDerived(target);
  expect(target.system.movement.ground.total).toBe(13);
});

test('Psycho Kit weapons follow the Path', () => {
  const venom = actor([sourced(D21.pathVenom, { type: 'role' })]);
  expect(kitWeaponsFor(venom)).toBe(KIT_WEAPONS[D21.pathVenom]);
  expect(kitWeaponsFor(venom)).not.toContain(D21.psychoDagger);
  expect(kitWeaponsFor(actor())).toBe(ALL_PSYCHO_WEAPONS);
});

test('drone Defense upgrades: best one per Defense', () => {
  const upgrade = (uuid, defense, value) => sourced(uuid, { type: 'upgrade', system: { type: 'drone', armorBonus: { defense, value } } });
  const drone = actor([upgrade(D21.basicDefenses, 'toughness', 1), upgrade(D21.advancedDefenses, 'toughness', 2), upgrade(D21.specializedDefenses, 'evasion', 3)], {
    type: 'companion', system: { type: 'drone', defenses: { toughness: { total: 12, string: '12' }, evasion: { total: 11, string: '11' } } },
  });
  expect(droneDefenseBonus(drone)).toEqual({ toughness: 2, evasion: 3 });
  applyDroneDefenses(drone);
  expect(drone.system.defenses.toughness.total).toBe(14);
  expect(drone.system.defenses.evasion.total).toBe(14);
  expect(droneDefenseBonus(actor([], { type: 'companion', system: { type: 'pet' } }))).toEqual({});
});

test('Sky Morpher: ↑1 Driving own Zord', () => {
  const pc = actor([sourced(D21.skyMorpher, { type: 'gear', name: 'Sky Morpher' })], { uuid: 'Actor.pc', system: { actors: { a: { uuid: 'Actor.z' } } } });
  const zord = actor([], { uuid: 'Actor.z', type: 'zord', system: { actors: { d: { uuid: 'Actor.pc', vehicleRole: 'driver' } } } });
  global.game.actors = [pc, zord];
  expect(skyMorpherSources(pc, null, { rolledSkill: 'driving' }).sources[0]).toMatchObject({ id: 'd21SkyMorpher', shiftUp: 1 });
  expect(skyMorpherSources(zord, null, { rolledSkill: 'driving' }).sources[0].shiftUp).toBe(1);
  expect(skyMorpherSources(pc, null, { rolledSkill: 'might' }).sources).toEqual([]);
  pc.system.actors = {};
  expect(skyMorpherSources(pc, null, { rolledSkill: 'driving' }).sources).toEqual([]);
});

test('Compassionate toggles give Edge, heal caps at max', async () => {
  const pony = actor([sourced(D21.compassionate)]);
  expect(compassionateToggles(pony, { rolledSkill: 'persuasion' }).map(t => t.name)).toEqual(['d21CompassionPeace', 'd21CompassionNeeds']);
  expect(compassionateToggles(actor(), { rolledSkill: 'persuasion' })).toEqual([]);
  const options = { edge: false, ext: { d21CompassionNeeds: true } };
  compassionateApply(pony, options);
  expect(options.edge).toBe(true);

  const hurt = actor([], { system: { health: { value: 3, max: 5 } } });
  hurt.canUserModify = () => true;
  expect(await healOne(hurt)).toBe(true);
  expect(hurt.update).toHaveBeenCalledWith({ 'system.health.value': 4 });
  expect(await healOne(actor([], { system: { health: { value: 5, max: 5 } } }))).toBe(false);
});

test('Larger Than Life reach and Mystic', () => {
  const claw = { type: 'weaponEffect', system: { classification: { style: 'melee' }, totalReach: 2, range: { reachMultiplier: 1 } }, flags: {} };
  const threat = actor([sourced(D21.largerThanLife), claw]);
  largerThanLifeReach(threat);
  expect(claw.system.totalReach).toBe(5);

  const mystic = actor([sourced(D21.mystic, { name: 'Mystic' })]);
  const mundane = actor([], { system: { defenses: { toughness: { armor: 3 } } } });
  expect(isNonMystical(mundane)).toBe(true);
  expect(isNonMystical(mystic)).toBe(false);
  expect(isNonMystical(actor([], { flags: { d21Mystical: true } }))).toBe(false);
  expect(mysticSources(mystic, mundane, { isAttack: true }).sources[0].shiftUp).toBe(1);
  expect(mysticSources(mystic, mystic, { isAttack: true }).sources).toEqual([]);
  expect(mysticDefense(mystic, mundane, 'toughness')).toBe(-3);
  expect(mysticDefense(mystic, mundane, 'evasion')).toBe(0);
});

test('Alternate Officer training update', () => {
  const update = officerTrainingUpdate();
  expect(update['system.trained.armors.medium']).toBe(false);
  expect(update['system.trained.weapons.explosives']).toBe(true);
  expect(update['system.trained.weapons.ballistic']).toBe(false);
});

test('Stinger Spray spends 1 Personal Power per attack', async () => {
  const { stingerSprayCost } = await import('./psycho.mjs');
  global.ui = { notifications: { warn: jest.fn() } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  const venom = actor([], { system: { powers: { personal: { value: 2 } } } });
  venom.getFlag = () => true;
  await stingerSprayCost(venom, {}, sourced(D21.stingerSprayEffects[0], { type: 'weaponEffect' }));
  expect(venom.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 1 });

  const empty = actor([], { system: { powers: { personal: { value: 0 } } } });
  empty.getFlag = () => false;
  await stingerSprayCost(empty, {}, sourced(D21.stingerSprayEffects[0], { type: 'weaponEffect' }));
  expect(empty.update).not.toHaveBeenCalled();
  expect(global.ui.notifications.warn).toHaveBeenCalledTimes(2);
});

test('the Stinger Spray Perk grants its weapon once', async () => {
  const { grantStingerSpray } = await import('./psycho.mjs');
  const holder = actor([sourced(D21.stingerSprayWeapon, { type: 'weapon' })]);
  expect(await grantStingerSpray({ parent: holder, ...sourced(D21.stingerSprayPerk) }, {}, 'u1')).toBeNull();
  expect(await grantStingerSpray({ parent: actor(), ...sourced(D21.stingerSprayPerk) }, {}, 'someone-else')).toBeNull();
});

test('Psycho Sword alternate halves the target', async () => {
  const { psychoAlternatePostRoll } = await import('./weapons.mjs');
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.fromUuid = async () => ({ name: 'Psycho Sword Alternate Effect', flags: { essence20: { d21HalveMovement: true } } });
  const target = actor([], { uuid: 'Actor.t' });
  target.setFlag = jest.fn();
  await psychoAlternatePostRoll(actor(), [], {}, { hits: [{ target, hit: true }], rider: { itemUuid: 'Item.x' } });
  expect(target.setFlag).toHaveBeenCalledWith('essence20', 'riderMarks', [expect.objectContaining({ kind: HALVE_KIND })]);
});
