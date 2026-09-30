import { jest } from '@jest/globals';

let jtt;
let ats;
let misc;
let spectrum;
let common;
let registry;

let n = 0;
const item = (type, source, extra = {}) => ({
  id: extra.id ?? `i${++n}`, name: extra.name ?? type, type, system: extra.system ?? {},
  flags: { core: { sourceId: source ?? null }, essence20: extra.flags ?? {} }, effects: [],
  update: jest.fn(async () => {}),
});
const actor = (type, items = [], system = {}, extra = {}) => {
  const a = {
    id: extra.id ?? `a${++n}`, uuid: extra.uuid ?? `Actor.a${n}`, name: extra.name ?? type, type, items, system,
    statuses: new Set(extra.statuses ?? []), flags: { essence20: { ...(extra.flags ?? {}) } },
    getFlag: (scope, key) => a.flags.essence20[key],
    setFlag: jest.fn(async (scope, key, value) => {
      a.flags.essence20[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete a.flags.essence20[key];
    }),
    update: jest.fn(async () => {}),
    getActiveTokens: () => extra.tokens ?? [],
  };
  items.forEach(i => {
    i.parent = a;
  });
  a.items.get = id => items.find(i => i.id == id);
  return a;
};

beforeAll(async () => {
  global.Hooks = { on: jest.fn(), once: jest.fn(), callAll: jest.fn() };
  global.game = {
    i18n: { localize: k => k, format: k => k }, user: { id: 'u1', isGM: true, targets: new Set() }, users: [],
    actors: [], settings: { get: () => 1 },
  };
  global.CONFIG = {
    E20: {
      actorSizes: { small: 1, common: 1, large: 1, long: 1, huge: 1, extended: 1, gigantic: 1, extended2: 1, towering: 1, extended3: 1, titanic: 1 },
      skillShiftList: ['criticalSuccess', 'autoSuccess', '3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20', 'autoFail', 'fumble'],
      skillToEssence: { persuasion: 'social', culture: 'smarts' },
      damageTypes: {},
    },
  };
  global.foundry = { utils: { randomID: () => 'r', deepClone: x => JSON.parse(JSON.stringify(x)) }, applications: { api: {} } };
  global.fromUuidSync = uuid => global.game.actors.find(a => a.uuid == uuid) ?? null;
  common = await import('./common.mjs');
  jtt = await import('./jtt.mjs');
  ats = await import('./ats.mjs');
  misc = await import('./misc.mjs');
  spectrum = await import('./spectrum.mjs');
  registry = (await import('../../extensions.mjs')).registrySnapshot();
});

beforeEach(() => {
  global.game.actors = [];
  global.game.combat = null;
  global.canvas = undefined;
});

test('every module registers its Use buttons', () => {
  expect(registry.uses.map(u => u.id)).toEqual(expect.arrayContaining([
    'pr1-overdrive', 'pr1-prospector-toolkit', 'pr1-time-displaced', 'pr1-warhead-magazines', 'pr1-be-an-example',
    'pr1-lightspeed-boost', 'pr1-tactical-size-shift', 'pr1-dragon-dagger', 'pr1-advanced-dino-gem',
  ]));
  expect(Object.keys(registry.chatButtons)).toEqual(expect.arrayContaining(['pr1DestinyFumble', 'pr1NemesisReroll', 'pr1TauntTest']));
});

test('Cloud Hatchet gives 30ft Aerial only while equipped', () => {
  const a = actor('playerCharacter', [item('weapon', common.PR1.cloudHatchet, { system: { equipped: true } })], { movement: { aerial: { total: 0 } } });
  jtt.cloudHatchetDerived(a);
  expect(a.system.movement.aerial.total).toBe(30);
  const b = actor('playerCharacter', [item('weapon', common.PR1.cloudHatchet, { system: { equipped: false } })], { movement: { aerial: { total: 0 } } });
  jtt.cloudHatchetDerived(b);
  expect(b.system.movement.aerial.total).toBe(0);
});

test('Mobile Headquarters: ↑1 for the crew, Megaform initiative', () => {
  const ranger = actor('playerCharacter');
  const zord = actor('zord', [item('feature', common.PR1.mobileHeadquarters, { name: 'Mobile HQ' })], {
    actors: { x: { uuid: ranger.uuid, vehicleRole: 'passenger' } },
    skills: { initiative: { shift: 'd4', edge: false } }, initiative: { skill: 'initiative' },
  });
  global.game.actors = [ranger, zord];
  expect(jtt.mobileHqSources(ranger, 'science')).toEqual([{ id: 'pr1MobileHq', label: 'Mobile HQ', shiftUp: 1 }]);
  expect(jtt.mobileHqSources(ranger, 'might')).toEqual([]);

  jtt.mobileHqDerived(zord);
  expect(zord.system.skills.initiative.edge).toBe(true);

  const other = actor('zord', [], { skills: { initiative: { shift: 'd8' } }, initiative: { skill: 'initiative' } });
  global.game.actors.push(other);
  const mega = actor('megaform', [], {
    actors: { a: { uuid: zord.uuid }, b: { uuid: other.uuid } },
    skills: { initiative: { shift: 'd20', edge: false } }, initiative: { skill: 'initiative' },
  });
  jtt.mobileHqDerived(mega);
  expect(mega.system.skills.initiative).toMatchObject({ shift: 'd8', edge: true });
});

// The rest of the scene is read at Initiative, never in derived data (reading other tokens' actors
// there builds their synthetic actors mid-preparation and loops on world load).
test('Mobile Headquarters gives allied vehicles and Zords in the scene Edge at Initiative', async () => {
  const hq = actor('zord', [item('feature', common.PR1.mobileHeadquarters)], { skills: { initiative: {} } });
  const ally = actor('vehicle', [], { skills: { initiative: { edge: false } }, initiative: { skill: 'initiative' } });
  global.canvas = { tokens: { placeables: [{ actor: hq }, { actor: ally }] } };

  jtt.mobileHqDerived(ally);
  expect(ally.system.skills.initiative.edge).toBe(false);

  const options = { edge: false };
  await jtt.mobileHqInitiative(ally, options);
  expect(options.edge).toBe(true);

  const onFoot = { edge: false };
  await jtt.mobileHqInitiative(actor('playerCharacter'), onFoot);
  expect(onFoot.edge).toBe(false);
});

test('Overdrive tracks its options per turn and adds Movement', () => {
  global.game.combat = { id: 'c1', round: 2, turn: 1, turns: [] };
  const zord = actor('zord', [], { movement: { ground: { total: 40 }, aerial: { total: 0 } } },
    { flags: { pr1Overdrive: { stamp: { combatId: 'c1', round: 2, turn: 1 }, options: ['move'] } } });
  expect(jtt.overdriveUsed(zord)).toEqual(['move']);
  jtt.overdriveDerived(zord);
  expect(zord.system.movement).toEqual({ ground: { total: 60 }, aerial: { total: 0 } });
  global.game.combat.turn = 2;
  expect(jtt.overdriveUsed(zord)).toEqual([]);
});

test('Profiteer lasts ten rounds of the scene', () => {
  global.game.combat = { id: 'c1', round: 3 };
  const a = actor('playerCharacter', [item('hangUp', common.PR1.profiteerHangUp, { name: 'Profiteer' })], {},
    { flags: { pr1ProfiteerQuestioned: { scene: 1, combatId: 'c1', round: 1 } } });
  expect(jtt.profiteerSources(a, 'persuasion')).toEqual([{ id: 'pr1Profiteer', label: 'Profiteer', shiftDown: 1 }]);
  expect(jtt.profiteerSources(a, 'culture')).toEqual([]);
  global.game.combat.round = 11;
  expect(jtt.profiteerLive(a)).toBe(false);
});

test('Prospector Toolkit rides the bonus-die bank on a Wealth Test only', async () => {
  const a = actor('playerCharacter', [], {}, { flags: { pr1ProspectorDie: '1d8' } });
  await jtt.prospectorPreRoll(a, { skill: 'wealth' });
  expect(a.flags.essence20.pendingMoreHeads).toMatchObject({ bonusDie: '1d8', pr1Prospector: '1d8' });
  expect(a.flags.essence20.pr1ProspectorDie).toBeUndefined();
  // A cancelled Wealth roll followed by something else puts it back.
  await jtt.prospectorPreRoll(a, { skill: 'athletics' });
  expect(a.flags.essence20.pendingMoreHeads).toBeUndefined();
  expect(a.flags.essence20.pr1ProspectorDie).toBe('1d8');
});

test('Time Displaced rolls one die larger; Warhead picks accumulate', () => {
  expect(jtt.largerDie('1d8')).toBe('1d10');
  expect(jtt.largerDie('2d8')).toBe('2d8');
  const zord = actor('zord', [
    item('feature', common.PR1.warheadMagazines, { flags: { pr1WarheadTypes: ['acid', 'fire', 'cold'] } }),
    item('feature', common.PR1.warheadMagazines, { flags: { pr1WarheadTypes: ['sonic', 'fire'] } }),
  ]);
  expect(jtt.warheadChoices(zord)).toEqual(['acid', 'fire', 'cold', 'sonic']);
});

test('Personal Heirloom equipment half only when no weapon is designated', () => {
  const weapon = item('weapon', null, { id: 'w1' });
  const a = actor('playerCharacter', [item('perk', common.PR1.personalHeirloom), weapon]);
  expect(jtt.heirloomIsEquipment(a)).toBe(true);
  a.flags.essence20.personalHeirloomItemId = 'w1';
  expect(jtt.heirloomIsEquipment(a)).toBe(false);
});

test("Can't Catch Me! loses its +1 when the defender can't be aware", () => {
  const d = actor('playerCharacter', [item('perk', common.PR1.cantCatchMe)]);
  expect(ats.cantCatchMeAdjust(actor('npc'), d, 'evasion')).toBe(0);
  expect(ats.cantCatchMeAdjust(actor('npc', [], {}, { statuses: ['invisible'] }), d, 'evasion')).toBe(-1);
  d.statuses.add('asleep');
  expect(ats.cantCatchMeAdjust(actor('npc'), d, 'toughness')).toBe(0);
  expect(ats.cantCatchMeAdjust(actor('npc'), d, 'evasion')).toBe(-1);
});

test('Clawed Armor: Alertness Edge, Snag to move the wearer', () => {
  const wearer = actor('playerCharacter', [item('armor', common.PR1.clawedArmor, { name: 'Clawed Armor', system: { equipped: true } })]);
  expect(ats.atsSources(wearer, null, { rolledSkill: 'alertness' })[0]).toMatchObject({ edge: true });
  const grab = item('weaponEffect', null, { system: { damageType: 'grapple' } });
  const attacker = actor('npc', [grab]);
  expect(ats.isForcedMoveAttempt(attacker, grab, false)).toBe(true);
  expect(ats.atsSources(attacker, wearer, { rolledSkill: 'athletics', item: grab })[0]).toMatchObject({ id: 'pr1ClawedAnchor', snag: true });
});

test('Destiny offers the Fumble to the GM on a plain failure', () => {
  const a = actor('playerCharacter', [item('hangUp', common.PR1.destinyHangUp)]);
  expect(ats.destinyOffer({ flags: { essence20: { rollFailed: true } } }, a, true)).toBe(true);
  expect(ats.destinyOffer({ flags: { essence20: { rollFailed: true, isFumble: true } } }, a, true)).toBe(false);
  expect(ats.destinyOffer({ flags: { essence20: { rollFailed: true } } }, a, false)).toBe(false);
});

test('Nemesis reroll compares against every Difficulty', () => {
  expect(ats.outcomesFor(15, [{ targetUuid: 'x', difficulty: 14 }, { targetUuid: 'y', difficulty: 16 }]).map(o => o.success)).toEqual([true, false]);
  const a = actor('playerCharacter', [item('perk', common.PR1.nemesis)], {}, { flags: { nemesisUuid: 'Actor.boss' } });
  expect(ats.nemesisInvolved(a, { flags: { essence20: { checkResults: [{ targetUuid: 'Actor.boss' }] } } })).toBe(true);
  expect(ats.nemesisInvolved(a, { flags: { essence20: { checkResults: [{ targetUuid: 'Actor.other' }] } } })).toBe(false);
});

test('Lightspeed Boost options', () => {
  const zord = actor('zord', [
    item('feature', common.PR1.lightspeedBoost, { flags: { pr1LightspeedBoost: { option: 'aeronautic' } } }),
    item('feature', common.PR1.lightspeedBoost, { flags: { pr1LightspeedBoost: { option: 'hazmat', how: 'resist', types: ['acid', 'cold'] } } }),
  ], { movement: { aerial: { total: 0 }, ground: { total: 40 } }, immunities: { fire: false }, resistances: { acid: false, cold: false } },
  { tokens: [{ document: { elevation: 20 } }] });
  ats.lightspeedDerived(zord);
  expect(zord.system.movement.aerial.total).toBe(40);
  expect(zord.system.resistances).toEqual({ acid: true, cold: true });
  expect(ats.lightspeedDefenseAdjust(zord, 'evasion')).toBe(2);
  expect(ats.lightspeedDefenseAdjust(zord, 'toughness')).toBe(0);
});

test('Power Flux tops up to 6 each; Power Wing adds 2 max', () => {
  const pilot = actor('playerCharacter', [], { powers: { personal: { value: 1, max: 10 } } });
  const low = actor('playerCharacter', [], { powers: { personal: { value: 2, max: 4 } } });
  const zord = actor('zord', [], { actors: { a: { uuid: pilot.uuid, vehicleRole: 'driver' }, b: { uuid: low.uuid, vehicleRole: 'passenger' } } });
  global.game.actors = [pilot, low, zord];
  expect(ats.powerFluxGains(zord).map(g => g.gain)).toEqual([6, 2]);
  const wing = actor('playerCharacter', [item('armor', common.PR1.powerWing, { system: { equipped: true } })], { powers: { personal: { max: 4 } } });
  ats.powerWingDerived(wing);
  expect(wing.system.powers.personal.max).toBe(6);
});

test('Tactical Size Shift and Warzord sizes', () => {
  expect(ats.shiftedSize('huge', 1)).toBe('extended');
  expect(ats.shiftedSize('towering', 1)).toBe('towering');
  expect(ats.shiftedSize('long', -1)).toBe('long');
  expect(ats.shiftedSize('huge', -2)).toBe('long');
  const zord = actor('zord', [item('feature', common.PR1.tacticalSizeShift, { flags: { pr1SizeShift: { direction: 'larger' } } })], { size: 'huge' });
  ats.sizeShiftDerived(zord);
  expect(zord.system.size).toBe('extended');
  const war = actor('zord', [item('feature', common.PR1.warzord)], { size: 'huge' });
  ats.sizeShiftDerived(war);
  expect(war.system.size).toBe('titanic');
});

test('Stand Behind Me! blocks an attack on anyone but the taunter', () => {
  global.game.combat = { id: 'c1', round: 2 };
  const taunter = actor('playerCharacter', [], {}, { flags: { standBehindMeActive: { combatId: 'c1', round: 2 } } });
  const foe = actor('npc', [], {}, { flags: { pr1Taunted: { by: taunter.uuid, combatId: 'c1', round: 2, resisted: false } } });
  global.game.actors = [taunter, foe];
  const attack = item('weaponEffect');
  expect(ats.tauntBlocks(foe, attack, [actor('playerCharacter')])).toBe(taunter);
  expect(ats.tauntBlocks(foe, attack, [taunter])).toBeNull();
  foe.flags.essence20.pr1Taunted.resisted = true;
  expect(ats.tauntBlocks(foe, attack, [])).toBeNull();
});

test('Be an Example, Rescue Injector and Phantom Ranger Prime sources', () => {
  const a = actor('playerCharacter', [
    item('perk', common.PR1.beAnExample, { name: 'Be an Example' }),
    item('weapon', common.PR1.rescueInjector, { system: { equipped: true } }),
    item('perk', common.PR1.phantomRangerPrime, { name: 'Phantom Ranger Prime' }),
  ], { isMorphed: true, originSkillsIncrease: 'culture', skills: { culture: {} } }, { flags: { pr1BeAnExample: { skill: 'culture' } } });
  expect(ats.originSkillOf(a)).toBe('culture');
  expect(ats.atsSources(a, null, { rolledSkill: 'culture' }).map(s => s.id)).toEqual(['pr1BeAnExample']);
  expect(ats.atsSources(a, null, { rolledSkill: 'science' }).map(s => s.id)).toEqual(['pr1RescueInjector']);
  const grid = item('power', null, { system: { type: 'grid' } });
  expect(ats.atsSources(a, null, { rolledSkill: 'might', item: grid }).map(s => s.id)).toEqual(['pr1PhantomPrime']);
});

test('Advanced Dino Gem Integration', () => {
  const pilot = actor('playerCharacter');
  const zord = actor('zord', [item('feature', common.PR1.advancedDinoGem, { name: 'ADGI', flags: { pr1DinoGem: 'sense' } })],
    { actors: { a: { uuid: pilot.uuid, vehicleRole: 'driver' } } });
  global.game.actors = [pilot, zord];
  expect(misc.dinoSources(pilot, null, { rolledSkill: 'alertness' })).toEqual([{ id: 'pr1DinoSense', label: 'ADGI', shiftUp: 2 }]);
  const shielded = actor('zord', [item('feature', common.PR1.advancedDinoGem, { flags: { pr1DinoGem: 'shield' } })]);
  const shot = item('weaponEffect', null, { system: { classification: { style: 'energy' } } });
  expect(misc.dinoSources(actor('npc'), shielded, { isAttack: true, item: shot })[0]).toMatchObject({ snag: true });
  const stealth = actor('zord', [item('feature', common.PR1.advancedDinoGem, { flags: { pr1DinoGem: 'stealth' } })], { movement: { ground: { total: 40 }, swim: { total: 0 } } });
  misc.dinoDerived(stealth);
  expect(stealth.system.movement).toEqual({ ground: { total: 50 }, swim: { total: 0 } });
  expect(misc.resonanceRound(6, 2)).toBe(4);
  expect(misc.resonanceRound(3, 2)).toBe(3);
});

test('Spectrum Shifted keeps the Table 2-16 row', async () => {
  const black = { name: 'Black Ranger' };
  const perk = item('perk', null, { name: 'You Got This!' });
  const other = item('perk', null, { name: 'Iron Bravado' });
  const quips = item('rolePoints', null, { name: 'Quips & Speeches', system: { resource: { startingMax: 2 } } });
  expect(await spectrum.spectrumShiftedRetains(null, black, perk, { level: 2 })).toBe(true);
  expect(await spectrum.spectrumShiftedRetains(null, black, other, { level: 2 })).toBe(false);
  expect(await spectrum.spectrumShiftedRetains(null, black, quips, {})).toBe(true);
  expect(quips.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.resource.max': 3, 'system.resource.increase': 0 }));
  expect(spectrum.frozenPoints({ system: { resource: { startingMax: null } } }, 2)).toMatchObject({ 'system.bonus.value': 2 });
  // No row: the old 1st-3rd level rule.
  expect(await spectrum.spectrumShiftedRetains(null, { name: 'Gold Ranger' }, other, { level: 2 })).toBe(true);
});
