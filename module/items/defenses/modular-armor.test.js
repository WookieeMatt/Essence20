import {
  applyModularIntegration,
  getModularAttachments,
  getModularCandidates,
  isModularArmor,
  isModularQualifyingWeapon,
  normalizeModularWeaponIds,
} from './modular-armor.mjs';

function makeWeapon(id, size = 'medium') {
  return { id, name: `Weapon ${id}`, type: 'weapon', system: { classification: { size }, derivedHands: 1, effectiveSize: size } };
}

function makeArmor({ allowance = 2, ids = [], equipped = true, traits = ['modular'] } = {}) {
  return {
    id: 'armor1',
    type: 'armor',
    system: { traits, upgradeTraits: [], modularAllowance: allowance, modularWeaponIds: ids, equipped },
  };
}

function makeActor(items) {
  const list = [...items];
  list.get = id => items.find(item => item.id == id);
  return { items: list };
}

describe('isModularArmor', () => {
  test('true for armor with the trait, own or upgrade-granted', () => {
    expect(isModularArmor(makeArmor())).toBe(true);
    expect(isModularArmor({ type: 'armor', system: { itemAndUpgradeTraits: ['modular'] } })).toBe(true);
    expect(isModularArmor({ type: 'armor', system: { traits: [], upgradeTraits: ['modular'] } })).toBe(true);
  });

  test('false for other armor and non-armor', () => {
    expect(isModularArmor(makeArmor({ traits: ['bulwark'] }))).toBe(false);
    expect(isModularArmor(makeWeapon('w1'))).toBe(false);
    expect(isModularArmor(null)).toBe(false);
  });
});

describe('isModularQualifyingWeapon', () => {
  test('Medium or smaller only', () => {
    for (const size of ['integrated', 'sidearm', 'light', 'medium']) {
      expect(isModularQualifyingWeapon(makeWeapon('w', size))).toBe(true);
    }

    expect(isModularQualifyingWeapon(makeWeapon('w', 'long'))).toBe(false);
    expect(isModularQualifyingWeapon(makeWeapon('w', 'heavy'))).toBe(false);
    expect(isModularQualifyingWeapon({ type: 'armor', system: {} })).toBe(false);
  });
});

describe('getModularAttachments', () => {
  test('resolves ids, skips missing/oversized, caps at the allowance', () => {
    const w1 = makeWeapon('w1');
    const big = makeWeapon('big', 'heavy');
    const w2 = makeWeapon('w2', 'sidearm');
    const w3 = makeWeapon('w3', 'light');
    const actor = makeActor([w1, big, w2, w3]);
    const armor = makeArmor({ allowance: 2, ids: ['gone', 'big', 'w1', 'w1', 'w2', 'w3'] });

    expect(getModularAttachments(actor, armor)).toEqual([w1, w2]);
  });

  test('zero allowance attaches nothing', () => {
    const actor = makeActor([makeWeapon('w1')]);
    expect(getModularAttachments(actor, makeArmor({ allowance: 0, ids: ['w1'] }))).toEqual([]);
  });
});

describe('applyModularIntegration', () => {
  test('socketed weapons in equipped Modular armor become Integrated with 0 hands', () => {
    const w1 = makeWeapon('w1');
    const w2 = makeWeapon('w2');
    const armor = makeArmor({ allowance: 1, ids: ['w1', 'w2'] });
    const actor = makeActor([armor, w1, w2]);

    applyModularIntegration(actor);

    expect(w1.system).toMatchObject({ modularIntegrated: true, effectiveSize: 'integrated', derivedHands: 0 });
    expect(w2.system.modularIntegrated).toBeUndefined();
    expect(w2.system.derivedHands).toBe(1);
    expect(armor.system.modularUsed).toBe(1);
  });

  test('unequipped armor records usage but grants nothing', () => {
    const w1 = makeWeapon('w1');
    const armor = makeArmor({ ids: ['w1'], equipped: false });
    applyModularIntegration(makeActor([armor, w1]));

    expect(armor.system.modularUsed).toBe(1);
    expect(w1.system.modularIntegrated).toBeUndefined();
    expect(w1.system.effectiveSize).toBe('medium');
  });

  test('tolerates a missing or non-iterable items collection', () => {
    expect(() => applyModularIntegration({})).not.toThrow();
    expect(() => applyModularIntegration({ items: { get: () => null } })).not.toThrow();
    expect(() => applyModularIntegration(null)).not.toThrow();
  });
});

describe('getModularCandidates', () => {
  test('lists qualifying weapons, locking unattached ones once full', () => {
    const w1 = makeWeapon('w1');
    const w2 = makeWeapon('w2');
    const big = makeWeapon('big', 'long');
    const armor = makeArmor({ allowance: 1, ids: ['w1'] });
    const actor = makeActor([armor, w1, w2, big]);

    expect(getModularCandidates(actor, armor)).toEqual([
      { id: 'w1', name: 'Weapon w1', attached: true, disabled: false },
      { id: 'w2', name: 'Weapon w2', attached: false, disabled: true },
    ]);
  });

  test('nothing for an unowned or non-Modular armor', () => {
    expect(getModularCandidates(null, makeArmor())).toEqual([]);
    expect(getModularCandidates(makeActor([]), makeArmor({ traits: [] }))).toEqual([]);
  });
});

describe('normalizeModularWeaponIds', () => {
  test('folds FormDataExtended checkbox output into a clean id list', () => {
    expect(normalizeModularWeaponIds(['w1', null, 'w2'])).toEqual(['w1', 'w2']);
    expect(normalizeModularWeaponIds('w1')).toEqual(['w1']);
    expect(normalizeModularWeaponIds(null)).toEqual([]);
    expect(normalizeModularWeaponIds(undefined)).toBeUndefined();
  });
});
