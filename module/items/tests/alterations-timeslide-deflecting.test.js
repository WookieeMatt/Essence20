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
      skillToEssence: { might: 'strength', athletics: 'strength', science: 'smarts' },
      defenses: { toughness: 'T', evasion: 'E' },
      elementDamageTypes: { fire: 'Fire' },
    },
    statusEffects: [],
  };
  global.foundry = { utils: { randomID: () => 'r', getProperty: (o, p) => p.split('.').reduce((a, k) => a?.[k], o) }, applications: { api: {} } };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.canvas = null;
});

let seq = 0;
function item(type, extra = {}) {
  return {
    id: extra.id ?? `i${seq++}`, name: extra.name ?? type, type,
    flags: { ...(extra.source ? { core: { sourceId: extra.source } } : {}), essence20: { ...(extra.flags ?? {}) } },
    system: extra.system ?? {},
  };
}

function actor(items = [], system = {}, extra = {}) {
  const list = [...items];
  const a = {
    uuid: extra.uuid ?? 'Actor.a', name: extra.name ?? 'Tester', type: 'playerCharacter',
    system: { level: 10, ...system },
    flags: { essence20: { ...(extra.flags ?? {}) } },
    items: Object.assign(list, { contents: list, get: id => list.find(i => i.id == id) }),
  };
  list.forEach(i => (i.parent = a));
  return a;
}

describe('jtt', () => {
  let jtt;
  beforeAll(async () => {
    jtt = await import('../movement/interspatial-pause-timeslide.mjs');
  });

  test('allFailed needs at least one compared result, all failed', () => {
    expect(jtt.allFailed([])).toBe(false);
    expect(jtt.allFailed([{ success: false }, { success: false }])).toBe(true);
    expect(jtt.allFailed([{ success: false }, { success: true }])).toBe(false);
  });

  test('Interspatial Pause blocks damage', async () => {
    const { registrySnapshot } = await import('../../mechanics/item-hooks.mjs');
    const paused = actor([], {}, { flags: { o1InterspatialPause: { by: 'x' } } });
    const mods = registrySnapshot().damageModifiers;
    const results = await Promise.all(mods.map(fn => fn(paused, 4, 'blunt', {})));
    expect(results).toContain(0);
  });
});

describe('alterations', () => {
  let alt;
  beforeAll(async () => {
    alt = await import('../../mechanics/characters/alteration-adjustments.mjs');
  });

  const essenceAlt = (extra = {}) => item('alteration', {
    name: 'Muscular Enhancement',
    system: { type: 'essence', availability: 'standard', essenceBonus: ['strength'], essenceCost: ['speed'], selectedEssence: 'speed', bonus: 'might', cost: 'acrobatics' },
    ...extra,
  });

  test('benefit and cost of an Essence Alteration', () => {
    const a = essenceAlt();
    expect(alt.benefitOf(a)).toEqual({ essences: { strength: 1 }, skills: { might: 1 }, movement: {} });
    expect(alt.costOf(a)).toEqual({ essences: { speed: -1 }, skills: { acrobatics: -1 }, movement: {} });
    expect(alt.costOf(a, { withEssence: false })).toEqual({ essences: {}, skills: { acrobatics: -1 }, movement: {} });
  });

  test('movement Alteration cost is its own cost only', () => {
    const m = item('alteration', { system: { type: 'movement', bonusMovementType: 'aerial', bonusMovement: 30, costMovementType: 'ground', costMovement: 10, movementCost: { ground: { value: 1 } } } });
    expect(alt.benefitOf(m).movement).toEqual({ aerial: 35 });
    expect(alt.costOf(m).movement).toEqual({ ground: -10 });
  });

  test('waiver budgets: Altered full, Additional Alteration partial', () => {
    const a = essenceAlt();
    const holder = actor([a, item('perk', { source: alt.O1_ALT.altered })], {}, {});
    expect(alt.waiverOptions(holder, a)).toEqual(['full']);
    a.flags.essence20.o1CostWaived = 'full';
    expect(alt.waiverOptions(holder, a)).toEqual([]);
    const b = essenceAlt({ system: { ...a.system, availability: 'limited' } });
    const both = actor([b, item('perk', { source: alt.O1_ALT.additionalAlteration })], {}, {});
    both.system.level = 7;
    expect(alt.waiverOptions(both, b)).toEqual(['partial']);
  });

  test('a waived cost is undone in the adjustments', () => {
    const a = essenceAlt({ flags: { o1CostWaived: 'full' } });
    const holder = actor([a]);
    const adj = alt.adjustmentsOf(holder);
    expect(adj.essences).toEqual({ speed: 1 });
    expect(adj.skills).toEqual({ acrobatics: 1 });
  });

  test('lends expire by rounds and scene', () => {
    const combat = { id: 'c', round: 12 };
    expect(alt.isLendExpired({ expire: { kind: 'rounds', combatId: 'c', round: 1, rounds: 10 } }, { combat, sceneEpoch: 0 })).toBe(true);
    expect(alt.isLendExpired({ expire: { kind: 'rounds', combatId: 'c', round: 5, rounds: 10 } }, { combat, sceneEpoch: 0 })).toBe(false);
    expect(alt.isLendExpired({ expire: { scene: 1 } }, { combat, sceneEpoch: 2 })).toBe(true);
  });

  test('Additional Alteration tiers open by level', () => {
    const holder = actor([], { level: 18 });
    expect(alt.openTiers(holder).map(t => t.level)).toEqual([15, 18]);
    holder.items.push(item('perk', { source: alt.O1_ALT.enhancedPart }));
    expect(alt.openTiers(holder).map(t => t.level)).toEqual([18]);
  });
});

describe('cobra gear', () => {
  let gear;
  beforeAll(async () => {
    gear = await import('../attacks/electromagnetic-deflecting-weapons.mjs');
  });

  test('computerized gear', () => {
    const armor = item('armor', { id: 'arm', system: { equipped: true, traits: ['computerized'] } });
    const t = actor([armor]);
    expect(gear.hasComputerizedGear(t)).toBe(true);
    armor.system.equipped = false;
    expect(gear.hasComputerizedGear(t)).toBe(false);
    expect(gear.hasComputerizedGear(actor([item('perk', { source: gear.O1_CC.enhancedPart })]))).toBe(true);
    expect(gear.hasComputerizedGear(actor([]))).toBe(false);
  });

  test('an upgrade on unequipped armor is not worn', () => {
    const armor = item('armor', { id: 'arm2', system: { equipped: false } });
    const up = item('upgrade', { flags: { parentId: 'arm2' }, system: { traits: ['computerized'] } });
    const t = actor([armor, up]);
    expect(gear.isWorn(up)).toBe(false);
    expect(gear.hasComputerizedGear(t)).toBe(false);
    armor.system.equipped = true;
    expect(gear.isWorn(up)).toBe(true);
    expect(gear.hasComputerizedGear(t)).toBe(true);
  });

  // Onslaught is a HitRider rule now (rules/conv10-slB10.test.js).
});

describe('more', () => {
  let more;
  beforeAll(async () => {
    more = await import('../forms/multimorph-rites.mjs');
  });

  // Only the best Armor Matrix counting is an OnlyBest rule on each matrix (module/rules/conv11-slG11.test.js).
  test('Multimorph offers other MLP Origins only', () => {
    const rows = [
      { uuid: 'Compendium.essence20.mlp_crb.Item.a', name: 'Pegasus', system: { items: { x: { type: 'perk', uuid: 'p' } } } },
      { uuid: 'Compendium.essence20.mlp_crb.Item.b', name: 'Unicorn', system: { items: { x: { type: 'perk', uuid: 'q' } } } },
      { uuid: 'Compendium.essence20.gi_joe_crb.Item.c', name: 'Brawler', system: { items: { x: { type: 'perk', uuid: 'r' } } } },
    ];
    const holder = actor([item('origin', { name: 'Unicorn' })]);
    expect(more.otherOrigins(rows, holder).map(r => r.name)).toEqual(['Pegasus']);
  });
});

test('the slice index registers its Use buttons', async () => {
  await import('../index.mjs');
  const { registrySnapshot } = await import('../../mechanics/item-hooks.mjs');
  const ids = registrySnapshot().uses.map(u => u.id);
  for (const id of ['o1InterspatialPause', 'o1Timeslide', 'o1Multimorph']) {
    expect(ids).toContain(id);
  }
});
