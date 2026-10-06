import { jest } from '@jest/globals';

beforeAll(() => {
  global.Hooks = { on: jest.fn(), once: jest.fn() };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.foundry = { utils: { escapeHTML: s => s, setProperty: () => {} } };
});

const mod = await import('./gij3.mjs');
const {
  G3, gij3RollSources, gij3PreRoll,
  addSilencedStatus, onTouchMoveInitiative,
} = mod;
const hooks = await import('./dice-hooks.mjs');
const disrupt = await import('./disrupt.mjs');
const ext = await import('../../extensions.mjs');

const src = uuid => ({ core: { sourceId: uuid } });
const item = (uuid, extra = {}) => ({
  id: extra.id ?? String(uuid).slice(-6), uuid: `Item.${extra.id ?? 'x'}`, name: extra.name ?? 'Thing', type: extra.type ?? 'perk',
  system: extra.system ?? {}, flags: { ...src(uuid), essence20: extra.flags ?? {} },
  setFlag: jest.fn(async function (scope, key, value) {
    this.flags.essence20[key] = value;
  }),
});
function actor(items = [], extra = {}) {
  const a = {
    id: extra.id ?? 'a1', uuid: extra.uuid ?? 'Actor.a1', name: extra.name ?? 'A', type: extra.type ?? 'playerCharacter',
    system: extra.system ?? {}, flags: { essence20: extra.flags ?? {} }, statuses: new Set(extra.statuses ?? []),
    items: { contents: items, get: id => items.find(i => i.id == id), find: fn => items.find(fn), some: fn => items.some(fn) }, documentName: 'Actor', isOwner: true,
  };
  items.forEach(i => {
    i.parent = a; 
  });
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
    settings: { get: () => 1 }, users: { activeGM: { isSelf: true } }, scenes: { viewed: null },
  };
  global.canvas = { scene: { tokens: [] } };
  global.CONFIG = { statusEffects: [], E20: {} };
  global.ChatMessage = { create: jest.fn(async () => ({})), getSpeaker: () => ({}) };
});

test('Subtle Snake and Second Skin are item rules now (rules/conv10-slC10.test.js)', async () => {
  expect(G3.subtleSnake).toBeUndefined();
  const dataset = { skill: 'athletics', essence: 'strength', requisitionItemName: 'Vest' };
  await gij3PreRoll(actor([]), dataset, null);
  expect(dataset.skill).toBe('athletics');
});

test('Touch Move posts once, naming un-surprised allies', async () => {
  const holder = actor([item(G3.touchMove, { name: 'Touch Move' })], { id: 'h' });
  const ally = actor([], { id: 'b', name: 'Bee' });
  const surprised = actor([], { id: 's', name: 'Sue', statuses: ['surprised'] });
  const combat = { id: 'c' };
  const combatant = { id: 'x', parent: combat, actor: holder, token: { disposition: 1 } };
  combat.combatants = [combatant, { actor: ally, token: { disposition: 1 } }, { actor: surprised, token: { disposition: 1 } }];
  await onTouchMoveInitiative(combatant, { initiative: 14 });
  await onTouchMoveInitiative(combatant, { initiative: 15 });
  expect(ChatMessage.create).toHaveBeenCalledTimes(1);
});

test('silenced status added once (Pillage and Dreadnok Recruit are item rules - rules/conv9-slC9.test.js)', () => {
  addSilencedStatus();
  addSilencedStatus();
  expect(CONFIG.statusEffects.filter(s => s.id == 'silenced')).toHaveLength(1);
});

test('everything registers with the extension registry', () => {
  const reg = ext.registrySnapshot();
  expect(reg.uses.some(u => u.id == 'gij3TechnicalGlitch')).toBe(true);
  expect(Object.keys(reg.chatButtons)).toEqual(expect.arrayContaining(['gij3Reboot', 'gij3CsfRepair']));
  // Junker and Targeting Eye are item rules now (rules/conv7-slC7.test.js).
  expect(reg.uses.some(u => ['gij3Junker', 'gij3TargetingEye', 'gij3DreadnokRecruit'].includes(u.id))).toBe(false);
  // Early Adopter, Field Trials and Peak Performance too (rules/conv10-slE10.test.js).
  expect(reg.uses.some(u => ['gij3EarlyAdopter', 'gij3FieldTrials', 'gij3PeakPerformance'].includes(u.id))).toBe(false);
  expect(Object.keys(reg.chatButtons)).not.toContain('gij3FreePick');
});

/* dice-hooks.mjs */

test('Better than the Best: natural 20 succeeds, or crits a success', () => {
  const holder = actor([item(hooks.BETTER_THAN_THE_BEST_ID)]);
  const roll = value => ({ dice: [{ faces: 20, values: [value] }] });
  expect(hooks.betterThanTheBestMultiplier(holder, roll(20), 0)).toBe(1);
  expect(hooks.betterThanTheBestMultiplier(holder, roll(20), 1)).toBe(2);
  expect(hooks.betterThanTheBestMultiplier(holder, roll(20), 3)).toBe(3);
  expect(hooks.betterThanTheBestMultiplier(holder, roll(19), 0)).toBe(0);
  expect(hooks.betterThanTheBestMultiplier(actor([]), roll(20), 0)).toBe(0);
});

test('Seconds Between Click & Boom: no miss effects on an Evasion attack', () => {
  // Its MissImmunity rule (rules/ext/b/readers.mjs) answers, against Evasion.
  const holder = actor([item('Compendium.essence20.gi_joe_crb.Item.ofiG5IwlURUwORYV', { system: { rules: [{ type: 'MissImmunity', when: ['defense:evasion'] }] } })]);
  expect(hooks.ignoresMissEffects(holder, 'evasion')).toBe(true);
  expect(hooks.ignoresMissEffects(holder, 'toughness')).toBe(false);
  expect(hooks.ignoresMissEffects(actor([]), 'evasion')).toBe(false);
  global.fromUuidSync = () => holder;
  expect(hooks.ignoresMissEffects('Actor.a1', 'evasion')).toBe(true);
});

/* disrupt.mjs */

test('Complete System Failure penalises rolls with the disrupted weapon', () => {
  const weapon = item('w', { id: 'w1', type: 'weapon', name: 'Rifle', flags: { gij3Disrupted: { csf: true, inoperable: false } } });
  const holder = actor([weapon]);
  const fx = { type: 'weaponEffect', flags: { essence20: { parentId: 'w1' } } };
  expect(disrupt.csfSource(holder, { item: fx })).toMatchObject({ snag: true, shiftDown: 2 });
  weapon.flags.essence20.gij3Disrupted = { csf: false, inoperable: true };
  expect(disrupt.csfSource(holder, { item: fx })).toBe(null);
  expect(gij3RollSources(holder, null, { item: fx }).sources).toEqual([]);
});

test('disruptable equipment and its DIF', () => {
  CONFIG.E20 = {};
  const computer = item('c', { type: 'gear', system: { traits: ['computerized'], availability: 'restricted' } });
  const plain = item('p', { type: 'weapon', system: { traits: [] } });
  const target = actor([computer, plain]);
  expect(disrupt.computerizedItems(target)).toEqual([computer]);
  expect(disrupt.equipmentItems(target)).toHaveLength(2);
  expect(disrupt.availabilityDif(computer)).toBe(15);
});

test('disrupting an item unequips it, and Reboot brings it back', async () => {
  CONFIG.E20 = {};
  const gear = item('c', { id: 'g1', type: 'gear', name: 'Radio', system: { traits: ['computerized'], equipped: true } });
  gear.isOwner = true;
  gear.update = jest.fn(async update => {
    for (const [key, value] of Object.entries(update)) {
      if (key == 'system.equipped') {
        gear.system.equipped = value;
      } else if (key.includes('-=')) {
        delete gear.flags.essence20.gij3Disrupted;
      } else if (key.endsWith('gij3Disrupted')) {
        gear.flags.essence20.gij3Disrupted = value;
      }
    }
  });
  const owner = actor([gear], { id: 'o' });
  const disruptor = actor([], { id: 'd', uuid: 'Actor.d' });
  await disrupt.disruptItem(disruptor, gear);
  expect(gear.system.equipped).toBe(false);
  expect(gear.flags.essence20.gij3Disrupted).toMatchObject({ inoperable: true, csf: false });
  expect(ChatMessage.create.mock.calls[0][0].content).toContain('gij3Reboot');

  global.fromUuid = async () => gear;
  await disrupt.onRebootButton(null, { dataset: { itemUuid: 'Item.g1' } });
  expect(gear.system.equipped).toBe(true);
  expect(gear.flags.essence20.gij3Disrupted).toBeUndefined();
  expect(owner.id).toBe('o');
});
