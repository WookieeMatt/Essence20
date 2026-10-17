import { jest } from '@jest/globals';

const hooks = {};
beforeAll(() => {
  global.Hooks = { on: jest.fn((name, fn) => {
    (hooks[name] ??= []).push(fn); 
  }), once: jest.fn(), callAll: jest.fn() };
  global.game = {
    i18n: { localize: k => k, format: (k, d) => `${k}:${JSON.stringify(d)}` },
    user: { id: 'u1', targets: new Set(), isGM: true },
    actors: [],
    combat: null,
    settings: { get: () => 3 },
  };
  global.CONFIG = {
    E20: {
      skills: { science: 'Sci', technology: 'Tech' },
      damageTypes: { sharp: 'Sharp', blunt: 'Blunt', element: 'Energy', fire: 'Fire', void: 'Void' },
      actorSizes: { small: 1, common: 1, large: 1, long: 1, huge: 1, extended: 1, gigantic: 1 },
      availabilityDifficulties: { limited: 10 },
    },
    statusEffects: [],
  };
  global.foundry = {
    data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, utils: {
      getProperty: (o, p) => p.split('.').reduce((a, k) => a?.[k], o),
      setProperty: (o, p, v) => {
        const keys = p.split('.');
        let cur = o;
        keys.slice(0, -1).forEach(k => {
          cur = cur[k] ??= {}; 
        });
        cur[keys.at(-1)] = v;
      },
      deepClone: o => JSON.parse(JSON.stringify(o)),
    },
    applications: { api: {} },
  };
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
    id: extra.id ?? `a${seq++}`, uuid: extra.uuid ?? 'Actor.a', name: extra.name ?? 'Tester', type: extra.type ?? 'playerCharacter',
    system, statuses: new Set(extra.statuses ?? []),
    flags: { essence20: { ...(extra.flags ?? {}) } },
    items: Object.assign(list, { contents: list, get: id => list.find(i => i.id == id) }),
  };
  a.getFlag = (scope, key) => a.flags[scope]?.[key];
  list.forEach(i => (i.parent = a));
  return a;
}

describe('decepticon', () => {

  // Junkplate / Pit Plates, Rust Derivatives and Stasis Cuffs are rules now (rules/conv10-slB10.test.js).

  test('Rites are rules now: Grant His Hunger, and In His Image (rules/conv10-slE10.test.js)', async () => {
    const { registrySnapshot } = await import('../../mechanics/item-hooks.mjs');
    expect(registrySnapshot().uses.map(use => use.id)).not.toContain('o2GrantHisHunger');
    expect(registrySnapshot().uses.map(use => use.id)).not.toContain('o2InHisImage');
  });
});

describe('medic', () => {
  let med;
  beforeAll(async () => {
    med = {
      ...(await import('../healing/medicine-kit.mjs')), ...(await import('../../mechanics/actions/heal-action.mjs')),
    };
  });

  test('restore DIF', () => {
    expect(med.restoreDif(1)).toBe(10);
    expect(med.restoreDif(4)).toBe(25);
  });

  test('heal Skills: Science and Technology (Hearty Meal adds its own through an ActionSkills rule - conv10-slC10)', () => {
    expect(med.healSkills(actor([]), { inCombat: false })).toEqual(['science', 'technology']);
  });

  test('a carried Science (Medicine) kit counts as a medicine kit (check:medicineKit)', () => {
    expect(med.hasMedicineKit(actor([item('perk', { source: 'Compendium.essence20.gi_joe_crb.Item.CUV2gVVGb7U7yU5J' })]))).toBe(false);
    const kit = item('gear', { name: 'Standard Science (Medicine) Kit', system: { gearType: 'kits' } });
    expect(med.hasMedicineKit(actor([kit]))).toBe(true);
  });
});

describe('gij', () => {
  let gij;
  beforeAll(async () => {
    gij = {
      ...(await import('../gear/support-upgrade-lending.mjs')),
      ...(await import('../attacks/two-light-weapons.mjs')),
    };
  });

  test('Support lends until the start of the next turn, Extended Support for the scene', () => {
    game.combat = { id: 'c', round: 2, turn: 3 };
    expect(gij.lendStamp(false)).toMatchObject({ kind: 'nextTurn', combatId: 'c', round: 2, turn: 2 });
    expect(gij.lendStamp(true)).toMatchObject({ kind: 'scene', scene: 3 });
    game.combat = null;
    expect(gij.lendStamp(false).kind).toBe('scene');
  });

  test('a lent armor Upgrade counts loose; a weapon Upgrade goes on the weapon', () => {
    const lender = actor([], {}, { name: 'Lender' });
    const up = { system: { type: 'armor' }, flags: { core: { sourceId: 'X' } }, toObject: () => ({ name: 'U', system: { type: 'armor' }, flags: { essence20: { parentId: 'p' } } }) };
    const copy = gij.lentCopy(up, { kind: 'scene' }, lender);
    expect(copy.flags.essence20.alterationWorn).toBe(true);
    expect(copy.flags.essence20.parentId).toBeUndefined();
    expect(copy.flags.core.sourceId).toBe('X');
    const weaponCopy = gij.lentCopy({ ...up, system: { type: 'weapon' } }, { kind: 'scene' }, lender, 'w1');
    expect(weaponCopy.flags.essence20.parentId).toBe('w1');
  });

  // Delegate is its Perk's own Use rule (rules/conv15-items2.test.js).

  test('Gunport is a rule on the upgrade now (no export, no constant here)', () => {
    expect(gij.firingThroughGunport).toBeUndefined();
    expect(gij.O2_GIJ).toBeUndefined();
  });

  test('two light weapons', () => {
    const knife = item('weapon', { id: 'k', system: { classification: { size: 'light' } } });
    const stab = item('weaponEffect', { flags: { parentId: 'k' } });
    const organic = item('armor', { id: 'o' });
    const computer = item('armor', { id: 'c', system: { traits: ['computerized'] } });
    const upgrade = item('upgrade', { name: 'Organic Battledress', flags: { parentId: 'o' } });
    actor([knife, stab, organic, computer, upgrade]);
    expect(gij.isLightWeaponAttack(stab)).toBe(true);
    // Bio-Tech Armor's pair is an ArmorPair rule now (rules/conv10-slB10.test.js).
  });
});

describe('magic', () => {
  let magic;
  beforeAll(async () => {
    magic = await import('../magic/temper-tempest-sorcery-builder.mjs');
  });

  // Temper Tempest's storm is the spell's own rules (rules/conv15-items2.test.js).

  test('Sorcerous Power costs follow Table 4-1', () => {
    // Arcane Bolt: a basic Targeting attack (Energy damage) - 1 point.
    expect(magic.sorceryCost({ base: 'targeting', damageType: 'energy', shape: 'none' })).toBe(1);
    expect(magic.sorceryPowerData({ base: 'targeting', damageType: 'energy', shape: 'none' }).system).toMatchObject({ damageType: 'energy', damageValue: 1 });
    // Another type (here Element) is a change: +1 point, +1 damage.
    expect(magic.sorceryCost({ base: 'targeting', damageType: 'element', shape: 'none' })).toBe(2);
    // Fireball: Fire (+1), 5ft blast (+1) - 3 points; 2 Fire damage.
    expect(magic.sorceryCost({ base: 'targeting', damageType: 'fire', shape: 'blast' })).toBe(3);
    expect(magic.sorceryPowerData({ base: 'targeting', damageType: 'fire', shape: 'blast' }).system).toMatchObject({ damageValue: 2, shape: 'circle', radius: 5, powerCost: 3 });
    // Wizard Missiles: Multi-Weapon (3) - 4 points.
    expect(magic.sorceryCost({ base: 'targeting', damageType: 'energy', shape: 'none', multiple: 3 })).toBe(4);
    // Lucky Charm: mimic a Perk (+2), 1-hour ritual (-2) - the book's 1 point: never below 1.
    expect(magic.sorceryCost({ base: 'mimic', ritual: 'hour', focus: true })).toBe(1);
    // Aura of Decay: Culture area (+2), Void (+2), +1 damage, costs Health (-2) - 3 points.
    expect(magic.sorceryCost({ base: 'area', damageType: 'void', shape: 'none', extraDamage: 1, resource: true })).toBe(3);
  });
});
