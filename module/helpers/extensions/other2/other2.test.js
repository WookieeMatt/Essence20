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
    utils: {
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
  let dd;
  beforeAll(async () => {
    dd = await import('./decepticon.mjs');
  });

  // Junkplate / Pit Plates, Rust Derivatives and Stasis Cuffs are rules now (rules/conv10-slB10.test.js).

  test('Rites are rules now: Grant His Hunger, and In His Image (rules/conv10-slE10.test.js)', async () => {
    expect(dd.inHisImageDif).toBeUndefined();
    expect(dd.hasEnergon).toBeUndefined();
    expect(dd.O2_DD).toBeUndefined();
    const { registrySnapshot } = await import('../../extensions.mjs');
    expect(registrySnapshot().uses.map(use => use.id)).not.toContain('o2GrantHisHunger');
    expect(registrySnapshot().uses.map(use => use.id)).not.toContain('o2InHisImage');
  });
});

describe('medic', () => {
  let med;
  beforeAll(async () => {
    med = await import('./medic.mjs');
  });

  test('restore DIF', () => {
    expect(med.restoreDif(1)).toBe(10);
    expect(med.restoreDif(4)).toBe(25);
  });

  test('heal Skills: Science and Technology (Hearty Meal adds its own through an ActionSkills rule - conv10-slC10)', () => {
    expect(med.healSkills(actor([]), { inCombat: false })).toEqual(['science', 'technology']);
  });

  test('a carried Science (Medicine) kit counts as a medicine kit (check:medicineKit)', () => {
    expect(med.hasMedicineKit(actor([item('perk', { source: med.O2_MED.properProtection })]))).toBe(false);
    const kit = item('gear', { name: 'Standard Science (Medicine) Kit', system: { gearType: 'kits' } });
    expect(med.hasMedicineKit(actor([kit]))).toBe(true);
  });

  test('Defibrillator runs six rounds', () => {
    const record = { combatId: 'c', readyRound: 7 };
    expect(med.defibrillatorReady(record, { id: 'c', round: 6 })).toBe(false);
    expect(med.defibrillatorReady(record, { id: 'c', round: 7 })).toBe(true);
    expect(med.defibrillatorReady(record, { id: 'd', round: 9 })).toBe(false);
  });
});

describe('gij', () => {
  let gij;
  beforeAll(async () => {
    gij = await import('./gij.mjs');
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

  test('Delegate finds the ally\'s spent uses', () => {
    game.combat = { id: 'c', round: 2, turn: 1 };
    const ally = actor([], {}, {
      flags: {
        luckUsed: { epoch: 3, window: 'scene', count: 1 },
        oldUse: { epoch: 1, window: 'scene', count: 1 },
        turnUse: { combatId: 'c', round: 2, turn: 1 },
        other: 'x',
      },
    });
    expect(gij.refundableUses(ally).map(r => r.key)).toEqual(['luckUsed', 'turnUse']);
    expect(gij.labelOf('luckUsedThisScene')).toBe('Luck Used This Scene');
    game.combat = null;
  });

  test('Gunport is a rule on the upgrade now (no export, no constant here)', () => {
    expect(gij.firingThroughGunport).toBeUndefined();
    expect(gij.O2_GIJ.gunport).toBeUndefined();
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
    magic = await import('./magic.mjs');
  });

  // More Bang's +1 on the storm is its cast HitRider rule now (rules/conv12-slI12.test.js).
  test('the Temper Tempest storm strikes for 3', async () => {
    expect(await magic.tempestDamage(actor([]))).toBe(3);
  });

  test('Sorcerous Power costs follow Table 4-1', () => {
    // Arcane Bolt: a basic Targeting attack - 1 point.
    expect(magic.sorceryCost({ base: 'targeting', damageType: 'element', shape: 'none' })).toBe(1);
    // Fireball: Fire (+1), 5ft blast (+1) - 3 points; 2 Fire damage.
    expect(magic.sorceryCost({ base: 'targeting', damageType: 'fire', shape: 'blast' })).toBe(3);
    expect(magic.sorceryPowerData({ base: 'targeting', damageType: 'fire', shape: 'blast' }).system).toMatchObject({ damageValue: 2, shape: 'circle', radius: 5, powerCost: 3 });
    // Wizard Missiles: Multi-Weapon (3) - 4 points.
    expect(magic.sorceryCost({ base: 'targeting', damageType: 'element', shape: 'none', multiple: 3 })).toBe(4);
    // Lucky Charm: mimic a Perk (+2), 1-hour ritual (-2)... never below zero.
    expect(magic.sorceryCost({ base: 'mimic', ritual: 'hour', focus: true })).toBe(0);
  });
});
