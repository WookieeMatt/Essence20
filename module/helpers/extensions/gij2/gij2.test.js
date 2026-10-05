import { jest } from '@jest/globals';

const item = (uuid, extra = {}) => ({
  id: extra.id ?? uuid.slice(-6), name: extra.name ?? 'Item', type: extra.type ?? 'perk',
  system: extra.system ?? {}, flags: { core: { sourceId: uuid }, essence20: extra.flags ?? {} },
  update: jest.fn(), setFlag: jest.fn(),
});
const actor = (items = [], extra = {}) => ({
  uuid: extra.uuid ?? 'Actor.a', name: extra.name ?? 'A', system: extra.system ?? {}, flags: { essence20: extra.flags ?? {} },
  items: { contents: items, get: id => items.find(i => i.id == id) }, statuses: new Set(), setFlag: jest.fn(), unsetFlag: jest.fn(),
});

let perks, shield, reckless, vehicles, artillery, G2;

beforeAll(async () => {
  global.game = { i18n: { localize: k => k, format: k => k }, user: { id: 'u', targets: new Set() }, actors: { get: () => null }, combat: null };
  global.CONFIG = {
    E20: {
      senses: { sight: 'Sight' },
      skillToEssence: { alertness: 'smarts', streetwise: 'social', science: 'smarts', technology: 'smarts', might: 'strength', targeting: 'speed' },
      skillShiftList: ['d12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'],
      skills: {}, essences: {}, damageTypes: { fire: 'Fire' },
    },
    statusEffects: [],
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.Hooks = { on: jest.fn(), once: jest.fn(), callAll: jest.fn() };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  ({ G2 } = await import('./shared.mjs'));
  perks = await import('./perks.mjs');
  shield = await import('./shield.mjs');
  reckless = await import('./reckless.mjs');
  vehicles = await import('./vehicles.mjs');
  artillery = await import('./artillery.mjs');
});

beforeEach(() => {
  global.game.combat = null;
  global.game.user.targets = new Set();
  global.ChatMessage.create.mockClear();
  global.ui.notifications.warn.mockClear();
});

test('Mentor adds an Essence to a Skill; Energy Resistant makes worn armor Resistant', () => {
  const armor = item('Compendium.x.Item.armor', { id: 'arm', type: 'armor', system: { equipped: true } });
  const holder = actor([
    item(G2.mentor, { flags: { [perks.MENTOR_FLAG]: { skill: 'might', essence: 'social' } } }),
    item(G2.energyResistant, { type: 'upgrade', flags: { [perks.ELEMENT_FLAG]: 'fire', parentId: 'arm' } }),
    armor,
  ], { system: { skills: { might: { essences: { strength: true } } }, resistances: {} } });
  perks.perkDerived(holder);
  expect(holder.system.skills.might.essences.social).toBe(true);
  expect(holder.system.resistances.fire).toBe(true);
  armor.system.equipped = false;
  holder.system.resistances = {};
  perks.perkDerived(holder);
  expect(holder.system.resistances.fire).toBeUndefined();
});

test('Expert Knowledge posts one or two extra benefits', async () => {
  const holder = actor([item(G2.expertKnowledge, { flags: { [perks.EXPERT_FLAG]: 'science' } })]);
  await perks.expertKnowledgePostRoll(holder, [{ success: true, multiplier: 1 }], { riderContext: { skill: 'science' } }, {});
  await perks.expertKnowledgePostRoll(holder, [{ success: true }], { riderContext: { skill: 'technology' } }, {});
  await perks.expertKnowledgePostRoll(holder, [{ success: false }], { riderContext: { skill: 'science' } }, {});
  expect(global.ChatMessage.create).toHaveBeenCalledTimes(1);
});

test('Nose For Trouble: Streetwise is offered when it is the better die', () => {
  const nose = actor([item(G2.noseForTrouble)], { system: { skills: { streetwise: { shift: 'd6' }, alertness: { shift: 'd20' } } } });
  expect(perks.streetwiseIsBetter(nose)).toBe(true);
});

test('Queen\'s Gambit slots an ally right after the current turn', () => {
  expect(perks.initiativeAfterCurrent({ turn: 0, turns: [{ initiative: 20 }, { initiative: 10 }] })).toBe(15);
  expect(perks.initiativeAfterCurrent({ turn: 1, turns: [{ initiative: 20 }, { initiative: 10 }] })).toBe(9);
});

test('Personal Shield gates, spends and expires', async () => {
  const rp = item(G2.personalShield, { type: 'rolePoints', system: { isActive: false, resource: { value: 1, max: 2 } } });
  const vanguard = actor([rp], { system: { level: 5 } });
  expect(shield.canActivatePersonalShield(vanguard, rp)).toBe(true);
  rp.system.resource.value = 0;
  expect(shield.canActivatePersonalShield(vanguard, rp)).toBe(false);
  rp.system.resource.value = 2;
  vanguard.flags.essence20[shield.BROKEN_FLAG] = true;
  expect(shield.canActivatePersonalShield(vanguard, rp)).toBe(false);
  expect(shield.repairDif(vanguard)).toBe(14);
  vanguard.flags.essence20[shield.ON_FLAG] = { combatId: 'c', round: 2 };
  expect(shield.shieldExpired(vanguard, { id: 'c', round: 11 })).toBe(false);
  expect(shield.shieldExpired(vanguard, { id: 'c', round: 12 })).toBe(true);
  vanguard.flags.essence20 = {};
  await shield.onShieldActivated(vanguard, rp);
  expect(rp.update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
});

test('Reckless Abandon: no kits, and the minute', () => {
  const rp = item(G2.recklessAbandon, { type: 'rolePoints', system: { isActive: true } });
  const renegade = actor([rp], { flags: { [reckless.START_FLAG]: { combatId: 'c', round: 1 } } });
  expect(reckless.kitsBlockedFor(renegade)).toBe(true);
  expect(reckless.minuteIsUp(renegade, { id: 'c', round: 11 })).toBe(true);
  expect(reckless.minuteIsUp(renegade, { id: 'c', round: 5 })).toBe(false);
  rp.system.isActive = false;
  expect(reckless.kitsBlockedFor(renegade)).toBe(false);
});

test('The Beat Goes On: Reckless Abandon survives no enemies left and being Defeated', async () => {
  const { registrySnapshot } = await import('../../extensions.mjs');
  const rp = item(G2.recklessAbandon, { type: 'rolePoints', system: { isActive: true } });
  const renegade = actor([rp, item(reckless.BEAT_GOES_ON)], { flags: { [reckless.START_FLAG]: { combatId: 'c', round: 1 } } });
  renegade.isOwner = true;
  const mine = { document: { disposition: 1, hidden: false }, actor: renegade };
  renegade.getActiveTokens = () => [mine];
  global.canvas = { tokens: { placeables: [mine] } };
  expect(reckless.enemiesRemain(renegade)).toBe(false);

  for (const fn of registrySnapshot().turnStart) {
    await fn(renegade, { id: 'c', round: 3 });
  }

  for (const fn of registrySnapshot().afterDamage) {
    await fn(renegade, 5, 'blunt', { newValue: 0 });
  }

  expect(rp.update).not.toHaveBeenCalled();
  global.canvas = undefined;
});

test('Roll Cage and Peerless Pilot', () => {
  const pilot = actor([item(G2.rollCage), item(G2.peerlessPilot)], { uuid: 'Actor.p' });
  global.fromUuidSync = uuid => (uuid == 'Actor.p' ? pilot : null);
  const vehicle = { uuid: 'Actor.v', id: 'v', system: { actors: { a: { uuid: 'Actor.p', vehicleRole: 'driver' } } } };
  expect(vehicles.rollCageProtects(vehicle)).toBe(true);
  expect(vehicles.autoPassesDisembark(pilot, vehicle)).toBe(true);
  vehicles.RESOLVING.set('Actor.v', { crew: new Set(['Actor.p']), mode: 'defeat', until: Date.now() + 5000, vehicle });
  expect(vehicles.rollCageDamage(pilot, 4, 'fire')).toBe(1);
  vehicles.RESOLVING.get('Actor.v').mode = 'crash';
  expect(vehicles.rollCageDamage(pilot, 3, 'blunt')).toBe(0);
  expect(vehicles.rollCageDamage(actor([], { uuid: 'Actor.z' }), 3, 'blunt')).toBe(3);
  vehicles.RESOLVING.clear();
});

test('Artillery rows list the damage each token takes', () => {
  const token = { id: 't', name: 'Viper', document: { uuid: 'Scene.s.Token.t' } };
  const html = artillery.strikeRows([token], { t: false }, artillery.STRIKES.he);
  expect(html).toContain('data-amount="1"');
  expect(artillery.strikeRows([token], { t: true }, artillery.STRIKES.shrapnel)).toContain('data-amount="4"');
});
