import { jest } from '@jest/globals';

const src = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;

let deps, mod;

function makeItem(type, pack, id, extra = {}) {
  return { type, name: extra.name ?? id, flags: { core: { sourceId: src(pack, id) }, ...(extra.flags ?? {}) }, system: extra.system ?? {}, id: extra.itemId ?? id };
}

function makeActor(items = [], extra = {}) {
  const flags = { essence20: { ...(extra.flags ?? {}) } };
  const actor = {
    uuid: extra.uuid ?? `Actor.${Math.random()}`,
    id: extra.id ?? 'a',
    name: extra.name ?? 'Pony',
    type: extra.type ?? 'playerCharacter',
    items: Object.assign([...items], { get: id => items.find(item => item.id == id) }),
    flags,
    statuses: new Set(extra.statuses ?? []),
    system: extra.system ?? {},
    setFlag: jest.fn(async (scope, key, value) => {
      flags.essence20[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flags.essence20[key];
    }),
    toggleStatusEffect: jest.fn(async (id, { active }) => {
      if (active) {
        actor.statuses.add(id);
      } else {
        actor.statuses.delete(id);
      }
    }),
    getActiveTokens: () => (extra.token ? [extra.token] : []),
  };
  return actor;
}

beforeAll(async () => {
  global.Hooks = { on: jest.fn(), once: jest.fn(), callAll: jest.fn() };
  global.game = {
    i18n: { localize: key => key, format: (key, data) => `${key}:${JSON.stringify(data)}` },
    user: { targets: new Set(), isGM: true, isActiveGM: true },
    users: { activeGM: null },
    actors: [],
    combat: null,
    messages: { contents: [] },
  };
  global.CONFIG = { E20: { skillToEssence: {} }, statusEffects: [] };
  global.foundry = { data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, utils: { randomID: () => 'r' }, applications: { api: {} } };
  global.ChatMessage = { create: jest.fn(async () => ({})), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn() } };
  global.fromUuid = jest.fn(async () => null);
  global.fromUuidSync = jest.fn(() => null);
  ({ deps } = await import('../shared/situation-checks.mjs'));
  mod = {
    ...(await import('../../mechanics/world/position-rules-refresh.mjs')),
  };
  await import('../rolls/situational-initiative-setup.mjs');
});

beforeEach(() => {
  deps.getTerrain = () => null;
  deps.getEnvironment = () => 'normal';
  deps.getSceneEpoch = () => 3;
  deps.nearbyAllies = () => [];
  game.user.targets = new Set();
  game.combat = null;
  global.ChatMessage.create.mockClear();
});

describe('roll sources', () => {
  test('item rules that read where the token stands are refreshed on a Region change', () => {
    const rules = when => ({ type: 'perk', flags: {}, system: { rules: [{ type: 'Movement', movement: 'swim', op: 'multiply', value: 2, when }] } });
    expect(mod.hasPositionRules(makeActor([rules(['check:seaOrWetlands'])]))).toBe(true);
    expect(mod.hasPositionRules(makeActor([rules([{ any: ['environment:outside:lowGravity'] }])]))).toBe(true);
    expect(mod.hasPositionRules(makeActor([rules(['not:terrain:set'])]))).toBe(true);
    expect(mod.hasPositionRules(makeActor([rules(['self:morphed'])]))).toBe(false);
    expect(mod.hasPositionRules(makeActor([{ type: 'perk', flags: {}, system: { rules: [{ type: 'RollModifier', edge: true, when: ['terrain:sea'] }] } }]))).toBe(false);
    expect(mod.hasPositionRules(makeActor([makeItem('perk', 'quartermasters_guide_to_gear', 'x')]))).toBe(false);
  });

  // Competitive, Take in a Scene and Misplaced Confidence are rules on their items (rules/conv15-items2.test.js).
});

