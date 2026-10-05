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

  test('Junkplate and Pit Plates sharpen unarmed hits only while worn', () => {
    const armor = item('armor', { id: 'arm', system: { equipped: false } });
    const plate = item('upgrade', { source: dd.O2_DD.junkplate, flags: { parentId: 'arm' } });
    const a = actor([armor, plate]);
    expect(dd.hasSharpUnarmed(a)).toBe(false);
    armor.system.equipped = true;
    expect(dd.hasSharpUnarmed(a)).toBe(true);
    expect(dd.hasSharpUnarmed(actor([item('upgrade', { source: dd.O2_DD.pitPlate })]))).toBe(true);

    const result = { damageType: 'blunt', criticalOptions: [{ key: 'double', damageType: 'blunt' }] };
    expect(dd.sharpenResult(result)).toBe(true);
    expect(result.damageType).toBe('sharp');
    expect(result.criticalOptions[0].damageType).toBe('sharp');
    expect(dd.sharpenResult({ damageType: 'fire' })).toBe(false);
  });

  test('Rust Derivatives blocks regaining Health only', () => {
    const a = actor([], { health: { value: 2 } }, { flags: { [dd.RUST_FLAG]: { by: 'x' } } });
    expect(dd.blockedHealing(a, { system: { health: { value: 4 } } })).toBe(true);
    expect(dd.blockedHealing(a, { system: { health: { value: 1 } } })).toBe(false);
    expect(dd.blockedHealing(actor([], { health: { value: 2 } }), { system: { health: { value: 4 } } })).toBe(false);
    expect(dd.weaponHasUpgrade(actor([item('upgrade', { source: dd.O2_DD.rustDerivatives, flags: { parentId: 'w' } })]), 'w', dd.O2_DD.rustDerivatives)).toBe(true);
  });

  test('Stasis Cuffs stop converting and Energon spending', () => {
    const a = actor([], { isTransformed: false, energon: { normal: { value: 3 }, dark: { value: 1 } } }, { flags: { [dd.CUFFS_FLAG]: { by: 'x' } } });
    expect(dd.cuffsBlock(a, { system: { isTransformed: true } })).toBe('convert');
    expect(dd.cuffsBlock(a, { system: { energon: { normal: { value: 2 } } } })).toBe('energon');
    expect(dd.cuffsBlock(a, { system: { energon: { dark: { value: 0 } } } })).toBe('energon');
    expect(dd.cuffsBlock(a, { system: { energon: { normal: { value: 4 } } } })).toBeNull();
    expect(dd.cuffsBlock(actor([], {}), { system: { isTransformed: true } })).toBeNull();
  });

  test('Rites: In His Image ignores armor; Grant His Hunger drains Energon from Cybertronians', () => {
    expect(dd.inHisImageDif(actor([], { defenses: { toughness: { total: 16, armor: 3 } } }))).toBe(13);
    expect(dd.hasEnergon(actor([], { canTransform: true }))).toBe(true);
    expect(dd.hasEnergon(actor([], { energon: { normal: { max: 0 } } }))).toBe(false);
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

  test('Hearty Meal adds Culture/Performance out of combat, once per mission', () => {
    const cook = actor([item('perk', { source: med.O2_MED.heartyMeal })]);
    expect(med.healSkills(cook, { inCombat: false })).toEqual(['science', 'technology', 'culture', 'performance']);
    expect(med.healSkills(cook, { inCombat: true })).toEqual(['science', 'technology']);
    cook.flags.essence20.o2HeartyMealHeal = { epoch: 3, window: 'mission', count: 1 };
    expect(med.healSkills(cook, { inCombat: false })).toEqual(['science', 'technology']);
  });

  test('a carried Science (Medicine) kit counts as a medicine kit (check:medicineKit)', () => {
    expect(med.hasMedicineKit(actor([item('perk', { source: med.O2_MED.properProtection })]))).toBe(false);
    const kit = item('gear', { name: 'Standard Science (Medicine) Kit', system: { gearType: 'kits' } });
    expect(med.hasMedicineKit(actor([kit]))).toBe(true);
  });

  test('Stim darts: one per mission plus carried extras', () => {
    const medic = actor([item('perk', { source: med.O2_MED.stimDart, name: 'Stim Dart' })]);
    expect(med.stimDartsLeft(medic)).toBe(1);
    medic.flags.essence20.o2StimDart = { epoch: 3, window: 'mission', count: 1 };
    expect(med.stimDartsLeft(medic)).toBe(0);
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

  test('Laser Designator lasts the scene', () => {
    expect(gij.isDesignated(actor([], {}, { flags: { [gij.DESIGNATED_FLAG]: { scene: 3 } } }))).toBe(true);
    expect(gij.isDesignated(actor([], {}, { flags: { [gij.DESIGNATED_FLAG]: { scene: 2 } } }))).toBe(false);
  });

  test('Battle Cry: round 1, before any Standard action', () => {
    const joe = actor([item('perk', { source: gij.O2_GIJ.yoJoe })]);
    const combatant = { flags: { essence20: { actions: { standard: 0, move: 1 } } } };
    const combat = { round: 1, getCombatantsByActor: () => [combatant] };
    expect(gij.battleCryActive(joe, combat)).toBe(true);
    combatant.flags.essence20.actions.standard = 1;
    expect(gij.battleCryActive(joe, combat)).toBe(false);
    expect(gij.battleCryActive(joe, { ...combat, round: 2 })).toBe(false);
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

  test('Frequency Interference', () => {
    expect(gij.contestFormula('d8')).toBe('1d20 + 1d8');
    expect(gij.contestFormula('2d8')).toBe('1d20 + 2d8');
    expect(gij.contestFormula('d20')).toBe('1d20');
    const weapon = item('weapon', { id: 'w', system: { traits: ['computerized'] } });
    const effect = item('weaponEffect', { flags: { parentId: 'w' } });
    const owner = actor([weapon, effect], {}, { flags: { [gij.JAMMED_FLAG]: ['w'] } });
    expect(gij.isComputerized(weapon)).toBe(true);
    expect(gij.isJammed(effect)).toBe(true);
    expect(gij.isJammed(item('weaponEffect'))).toBe(false);
    expect(owner.items.length).toBe(2);
  });

  test('Explosive Engineer: grenades by name', () => {
    const grenade = item('weapon', { id: 'g', name: 'Frag Grenade' });
    const effect = item('weaponEffect', { name: 'Frag', flags: { parentId: 'g' } });
    actor([grenade, effect]);
    expect(gij.isGrenade(effect)).toBe(true);
    expect(gij.isGrenade(item('weaponEffect', { name: 'Rocket' }))).toBe(false);
  });

  test('Big Rigger cancels the size upshift unless defending with Evasion', () => {
    global.fromUuidSync = () => actor([item('perk', { source: gij.O2_GIJ.bigRigger })]);
    const truck = actor([], { size: 'gigantic', actors: { d: { vehicleRole: 'driver', uuid: 'D' } } }, { type: 'vehicle' });
    const soldier = actor([], { size: 'common' });
    expect(gij.sizeShift(soldier, truck)).toBe(2);
    expect(gij.riggerCancel(soldier, truck, 'toughness')?.shift).toBe(2);
    expect(gij.riggerCancel(soldier, truck, 'evasion')).toBeNull();
    expect(gij.riggerCancel(actor([], { size: 'gigantic' }), truck, 'toughness')).toBeNull();
  });

  test('Gunport only through an active shield', () => {
    const shield = item('shield', { id: 's', system: { equipped: true, active: false } });
    const port = item('upgrade', { source: gij.O2_GIJ.gunport, flags: { parentId: 's' } });
    const a = actor([shield, port]);
    expect(gij.firingThroughGunport(a)).toBe(false);
    shield.system.active = true;
    expect(gij.firingThroughGunport(a)).toBe(true);
  });

  test('two light weapons and Bio-Tech Armor pairs', () => {
    const knife = item('weapon', { id: 'k', system: { classification: { size: 'light' } } });
    const stab = item('weaponEffect', { flags: { parentId: 'k' } });
    const organic = item('armor', { id: 'o' });
    const computer = item('armor', { id: 'c', system: { traits: ['computerized'] } });
    const upgrade = item('upgrade', { name: 'Organic Battledress', flags: { parentId: 'o' } });
    actor([knife, stab, organic, computer, upgrade]);
    expect(gij.isLightWeaponAttack(stab)).toBe(true);
    expect(gij.bioTechPair(organic, computer)).toBe(true);
    expect(gij.bioTechPair(computer, computer)).toBe(false);
  });
});

describe('magic', () => {
  let magic;
  beforeAll(async () => {
    magic = await import('./magic.mjs');
  });

  test('Thorn Warlord: Acid in Monster Form measured against Evasion', () => {
    const warlord = actor([item('perk', { source: magic.O2_MAGIC.thornWarlord })], {}, { flags: { monsterFormActive: true } });
    const defender = actor([], { defenses: { toughness: { total: 18 }, evasion: { total: 12 } } });
    const acid = { item: { system: { damageType: 'acid' } } };
    const adjust = magic.thornWarlordAdjust(warlord, defender, 'toughness', acid);
    expect(adjust).toBe(-6);
    expect(magic.thornWarlordAdjust(warlord, defender, 'evasion', acid)).toBe(0);
  });

  test('More Bang: listed elemental spells and Fire', () => {
    expect(magic.isElementalSpell(magic.O2_MAGIC.fireball, null)).toBe(true);
    expect(magic.isElementalSpell('X', 'fire')).toBe(true);
    expect(magic.isElementalSpell('X', 'element')).toBe(false);
    expect(magic.tempestDamage(actor([item('perk', { source: magic.O2_MAGIC.moreBang })]))).toBe(4);
    expect(magic.tempestDamage(actor([]))).toBe(3);
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
