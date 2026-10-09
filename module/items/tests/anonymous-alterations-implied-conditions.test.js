import { jest } from '@jest/globals';

beforeAll(() => {
  global.Hooks = { on: jest.fn(), once: jest.fn(), callAll: jest.fn() };
  global.game = {
    i18n: { localize: k => k, format: (k, d) => `${k}:${JSON.stringify(d)}` },
    user: { id: 'u1', targets: new Set(), isGM: true },
    actors: [],
    combat: null,
    settings: { get: () => 0 },
  };
  global.CONFIG = {
    E20: {
      skillToEssence: { persuasion: 'social', science: 'smarts', athletics: 'strength' },
      skills: { persuasion: 'P', science: 'S', athletics: 'A' },
      availabilityDifficulties: { standard: 0, limited: 10 },
    },
    statusEffects: [],
  };
  global.foundry = { data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, utils: { getProperty: (o, p) => p.split('.').reduce((a, k) => a?.[k], o), escapeHTML: s => s }, applications: { api: {} } };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.canvas = null;
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
});

function actor(items = [], system = {}, extra = {}) {
  const list = [...items];
  const flags = { essence20: { ...(extra.flags ?? {}) } };
  const a = {
    id: extra.id ?? 'a', uuid: extra.uuid ?? 'Actor.a', name: extra.name ?? 'Tester', type: extra.type ?? 'playerCharacter',
    system: { level: 10, ...system },
    flags,
    statuses: extra.statuses ?? new Set(),
    getFlag: (scope, key) => flags[scope]?.[key],
    items: Object.assign(list, { contents: list, get: id => list.find(i => i.id == id) }),
  };
  list.forEach(i => (i.parent = a));
  return a;
}

// Anonymous is the upgrade's own incoming rules (rules/conv15-items2.test.js).

describe('conditions', () => {
  let conditions;
  beforeAll(async () => {
    conditions = await import('../../mechanics/combat/implied-conditions.mjs');
  });

  test('Asleep implies Prone and Unconscious; Defeated implies Prone', () => {
    const sleeper = actor([], {}, { statuses: new Set(['asleep']) });
    conditions.addImpliedStatuses(sleeper);
    expect([...sleeper.statuses].sort()).toEqual(['asleep', 'prone', 'unconscious']);
    const down = actor([], {}, { statuses: new Set(['defeated']) });
    conditions.addImpliedStatuses(down);
    expect(down.statuses.has('prone')).toBe(true);
    expect(down.statuses.has('unconscious')).toBe(false);
  });

  test('damage wakes a sleeper', async () => {
    const a = actor();
    a.effects = [{ statuses: new Set(['asleep']) }];
    a.toggleStatusEffect = jest.fn();
    expect(await conditions.wakeOnDamage(a, 1)).toBe(true);
    expect(a.toggleStatusEffect).toHaveBeenCalledWith('asleep', { active: false });
    expect(await conditions.wakeOnDamage(a, 0)).toBe(false);
  });
});
