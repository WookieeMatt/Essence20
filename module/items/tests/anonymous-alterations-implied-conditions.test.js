import { jest } from '@jest/globals';

const CCX = id => `Compendium.essence20.cobra_codex.Item.${id}`;

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
  global.foundry = { utils: { getProperty: (o, p) => p.split('.').reduce((a, k) => a?.[k], o), escapeHTML: s => s }, applications: { api: {} } };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.canvas = null;
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
});

let seq = 0;
function item(type, extra = {}) {
  return {
    id: extra.id ?? `i${seq++}`, name: extra.name ?? type, type,
    flags: { ...(extra.source ? { core: { sourceId: extra.source } } : {}), essence20: { ...(extra.flags ?? {}) } },
    system: extra.system ?? {},
    effects: extra.effects ?? [],
  };
}

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

describe('gear', () => {
  let gear;
  beforeAll(async () => {
    gear = await import('../defenses/anonymous-upgrade.mjs');
  });

  test('Anonymous snags a repeat Outwit from an Inundation holder', () => {
    const target = actor([item('upgrade', { source: CCX('yFikSROr3NzaEoaL') })], {}, { uuid: 'Actor.t' });
    const attacker = actor([item('perk', { source: 'Compendium.essence20.gi_joe_crb.Item.Q09tkHIaVX65lokl' })], {}, {
      flags: { outwittedTargets: { 'Actor-t': true } },
    });
    expect(gear.anonymousSnag(attacker, target, { rolledSkill: 'deception' })?.snag).toBe(true);
    expect(gear.anonymousSnag(attacker, target, { rolledSkill: 'athletics' })).toBeNull();
    expect(gear.anonymousSnag(attacker, actor([], {}, { uuid: 'Actor.x' }), { rolledSkill: 'deception' })).toBeNull();
  });
});

describe('perks', () => {
  let perks;
  beforeAll(async () => {
    perks = await import('../gear/alteration-perk-picks.mjs');
  });

  test('every Alteration-granting General Perk has a pick-an-Alteration Use, at its own tier', async () => {
    const { findExtUse } = await import('../../mechanics/item-hooks.mjs');
    const tiers = {
      wCL3rJOEDZVHVg6g: ['standard', 'cybernetic'], eT4g9EfrFtvjMqWu: ['limited', 'cybernetic'], zGsTAngJ2HRdKPkz: ['restricted', 'cybernetic'],
      zuR9YJ2Wy956VGGy: ['standard', 'genetic'], '7cL4aUwJwqvbhYCz': ['limited', 'genetic'], RcGUjeMpsNDFjwmL: ['restricted', 'genetic'],
    };
    for (const [id, [availability, form]] of Object.entries(tiers)) {
      expect(perks.ALTERATION_PERKS[CCX(id)]).toEqual({ availability, form });
      const perk = item('perk', { source: CCX(id) });
      actor([perk]);
      const use = findExtUse(perk);
      expect(use?.id).toBe(`gij1Setup-${id}`);
      expect(use.canUse(perk)).toBe(true);
      perk.flags.essence20.granted = true;
      expect(use.canUse(perk)).toBe(false);
    }

    // Beast Mode's scene-long copies don't hand out a permanent Alteration.
    const beast = item('perk', { source: CCX('zuR9YJ2Wy956VGGy'), flags: { beastMode: true } });
    actor([beast]);
    expect(findExtUse(beast).canUse(beast)).toBe(false);
  });
});

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
