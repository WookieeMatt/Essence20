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

let shield, vehicles, G2;

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
  ({ G2 } = await import('../shared/gij-crb-item-lookups.mjs'));
  shield = await import('../defenses/personal-shield-uses.mjs');
  vehicles = await import('../vehicles/roll-cage.mjs');
});

beforeEach(() => {
  global.game.combat = null;
  global.game.user.targets = new Set();
  global.ChatMessage.create.mockClear();
  global.ui.notifications.warn.mockClear();
});

// (Nose For Trouble's Streetwise-for-Alertness offer is a SkillSubstitution ask rule on the Perk - rules/conv17-split2.test.js.)

// Queen's Gambit is its Perk's own rules (@initiative.afterCurrent - rules/engine15-items2.test.js).

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

// Reckless Abandon's end (a minute, no enemies, Defeated), its no-kits Veto and The Beat Goes On are rules on the Role
// Points item (rules/conv15-items2.test.js).

// Peerless Pilot's automatic disembark is its AutoDisembark rule (module/rules/conv10-slA10.test.js).
test('Roll Cage', () => {
  // Roll Cage answers through its CrashProtection rule.
  const pilot = actor([item('Compendium.essence20.gi_joe_crb.Item.H49a6v04JMtbUpDf', { system: { rules: [{ type: 'CrashProtection' }] } })], { uuid: 'Actor.p' });
  global.fromUuidSync = uuid => (uuid == 'Actor.p' ? pilot : null);
  const vehicle = { uuid: 'Actor.v', id: 'v', system: { actors: { a: { uuid: 'Actor.p', vehicleRole: 'driver' } } } };
  expect(vehicles.rollCageProtects(vehicle)).toBe(true);
  vehicles.RESOLVING.set('Actor.v', { crew: new Set(['Actor.p']), mode: 'defeat', until: Date.now() + 5000, vehicle });
  expect(vehicles.rollCageDamage(pilot, 4, 'fire')).toBe(1);
  vehicles.RESOLVING.get('Actor.v').mode = 'crash';
  expect(vehicles.rollCageDamage(pilot, 3, 'blunt')).toBe(0);
  expect(vehicles.rollCageDamage(actor([], { uuid: 'Actor.z' }), 3, 'blunt')).toBe(3);
  vehicles.RESOLVING.clear();
});

// Artillery Support is the gear's own Use rule (rules/conv15-items2.test.js).
