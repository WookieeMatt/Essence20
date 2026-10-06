import { jest } from '@jest/globals';

let ats;
let spectrum;
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
  ats = { ...(await import('../attacks/stand-behind-me-taunt.mjs')) };
  spectrum = await import('../../mechanics/characters/spectrum-shifted.mjs');
  registry = (await import('../../mechanics/item-hooks.mjs')).registrySnapshot();
});

beforeEach(() => {
  global.game.actors = [];
  global.game.combat = null;
  global.canvas = undefined;
});

test('every module registers its Use buttons', () => {
  // Time Displaced and Lightspeed Boost are their items' own Use rules (module/rules/conv17-split2.test.js).
  expect(registry.uses.map(u => u.id)).not.toContain('pr1-time-displaced');
  expect(registry.uses.map(u => u.id)).not.toContain('pr1-lightspeed-boost');
  expect(registry.uses.map(u => u.id)).not.toContain('pr1-advanced-dino-gem');
  // Tactical Size Shift is the Feature's own rules (module/rules/conv12-slH12.test.js).
  expect(registry.uses.map(u => u.id)).not.toContain('pr1-tactical-size-shift');
  // Warhead Magazines is the Feature's own rules (module/rules/conv11-slG11.test.js).
  expect(registry.uses.map(u => u.id)).not.toContain('pr1-warhead-magazines');
  // Overdrive is the Feature's own rules (module/rules/conv10-slA10.test.js).
  expect(registry.uses.map(u => u.id)).not.toContain('pr1-overdrive');
  expect(Object.keys(registry.chatButtons)).toEqual(expect.arrayContaining(['pr1TauntTest']));
});

// Mobile Headquarters is the Feature's own rules: SkillDie (module/rules/conv11-slF11.test.js) and the scene allies'
// InitiativeEdge (module/rules/conv12-slH12.test.js).

// Time Displaced's larger Continuum Anomaly die and Lightspeed Boost's pick and its Evasion in flight / submerged are the
// items' own rules (module/rules/conv17-split2.test.js); the Movement / Resistance half too (module/rules/conv5-slA5.test.js).

// Power Flux is the Feature's own Trigger rule (module/rules/conv7-slA7.test.js).

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

// Be an Example is its Origin Benefit's own Use rule (rules/conv15-items2.test.js).

// Enhanced Stealth's +10 ft is the item's own Movement rules now (module/rules/conv5-slA5.test.js); Genetic
// Resonance is its SummonTime rule (module/rules/conv10-slA10.test.js).

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
