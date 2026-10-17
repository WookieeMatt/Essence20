import { jest } from '@jest/globals';

beforeAll(() => {
  global.Hooks = { on: jest.fn(), once: jest.fn() };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.foundry = { data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, utils: { escapeHTML: s => s, setProperty: () => {} } };
});

const hooks = await import('./miss-effect-immunity.mjs');

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

test('Seconds Between Click & Boom: no miss effects on an Evasion attack', () => {
  // Its MissImmunity rule (rules/plugins/combat/immunity-readers.mjs) answers, against Evasion.
  const holder = actor([item('Compendium.essence20.gi_joe_crb.Item.ofiG5IwlURUwORYV', { system: { rules: [{ type: 'MissImmunity', when: ['defense:evasion'] }] } })]);
  expect(hooks.ignoresMissEffects(holder, 'evasion')).toBe(true);
  expect(hooks.ignoresMissEffects(holder, 'toughness')).toBe(false);
  expect(hooks.ignoresMissEffects(actor([]), 'evasion')).toBe(false);
  global.fromUuidSync = () => holder;
  expect(hooks.ignoresMissEffects('Actor.a1', 'evasion')).toBe(true);
});
