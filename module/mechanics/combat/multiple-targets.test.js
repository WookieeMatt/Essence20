import { jest } from '@jest/globals';
import { isMultipleTargetsWeapon } from './multiple-targets.mjs';

function makeActor({ perkIds = [], weaponTraits = [], itemAndUpgradeTraits = [] } = {}) {
  const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
  items.get = jest.fn(id => (id == 'weapon1'
    ? { system: { traits: weaponTraits, itemAndUpgradeTraits } }
    : null));

  return { items };
}

function weaponEffect({ style = 'melee' } = {}) {
  return {
    type: 'weaponEffect',
    flags: { essence20: { parentId: 'weapon1' } },
    system: { classification: { style } },
  };
}

describe("isMultipleTargetsWeapon", () => {
  test("false for a non-weaponEffect item", () => {
    expect(isMultipleTargetsWeapon(makeActor(), { type: 'perk' })).toBe(false);
    expect(isMultipleTargetsWeapon(makeActor(), null)).toBe(false);
  });

  test("true when the parent weapon actually carries the multipleTargets trait", () => {
    const actor = makeActor({ itemAndUpgradeTraits: ['multipleTargets'] });
    expect(isMultipleTargetsWeapon(actor, weaponEffect())).toBe(true);
  });

  test("false without the trait (Charge Into Battle's grant is a MultipleTargets rule - rules/conv17-split2.test.js)", () => {
    const actor = makeActor({ weaponTraits: ['powerWeapon'] });
    expect(isMultipleTargetsWeapon(actor, weaponEffect())).toBe(false);
  });

  describe("Volley (PR CRB, Pink Ranger, 1st level, p.48)", () => {
    test("grants it for a ranged weapon while active", () => {
      const actor = makeActor();
      actor.getFlag = jest.fn((scope, key) => key == 'volleyActive');
      expect(isMultipleTargetsWeapon(actor, weaponEffect({ style: 'projectile' }))).toBe(true);
    });

    test("doesn't apply to a melee weapon, or while inactive", () => {
      const actor = makeActor();
      actor.getFlag = jest.fn((scope, key) => key == 'volleyActive');
      expect(isMultipleTargetsWeapon(actor, weaponEffect({ style: 'melee' }))).toBe(false);

      const inactiveActor = makeActor();
      expect(isMultipleTargetsWeapon(inactiveActor, weaponEffect({ style: 'projectile' }))).toBe(false);
    });
  });
});
