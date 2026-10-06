import { jest } from '@jest/globals';

beforeAll(() => {
  global.Hooks = { on: jest.fn(), once: jest.fn() };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.foundry = { utils: { escapeHTML: s => s, setProperty: () => {} } };
});

const hooks = await import('./better-than-the-best.mjs');

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

test('Better than the Best: natural 20 succeeds, or crits a success', () => {
  const holder = actor([item(hooks.BETTER_THAN_THE_BEST_ID)]);
  const roll = value => ({ dice: [{ faces: 20, values: [value] }] });
  expect(hooks.betterThanTheBestMultiplier(holder, roll(20), 0)).toBe(1);
  expect(hooks.betterThanTheBestMultiplier(holder, roll(20), 1)).toBe(2);
  expect(hooks.betterThanTheBestMultiplier(holder, roll(20), 3)).toBe(3);
  expect(hooks.betterThanTheBestMultiplier(holder, roll(19), 0)).toBe(0);
  expect(hooks.betterThanTheBestMultiplier(actor([]), roll(20), 0)).toBe(0);
});
