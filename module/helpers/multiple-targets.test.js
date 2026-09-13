import { jest } from '@jest/globals';
import { isMultipleTargetsWeapon } from './multiple-targets.mjs';

const CHARGE_INTO_BATTLE_ID = "Compendium.essence20.through_the_shattered_grid.Item.34O7Y77lZpuhng3G";

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

  test("false without the trait, without Charge Into Battle", () => {
    const actor = makeActor({ weaponTraits: ['powerWeapon'] });
    expect(isMultipleTargetsWeapon(actor, weaponEffect())).toBe(false);
  });

  describe("Charge Into Battle (Through the Shattered Grid, Guardian of Eltar, 2nd level, p.72)", () => {
    test("grants it for a melee Power Weapon lacking the trait, with the Perk", () => {
      const actor = makeActor({ perkIds: [CHARGE_INTO_BATTLE_ID], weaponTraits: ['powerWeapon'] });
      expect(isMultipleTargetsWeapon(actor, weaponEffect({ style: 'melee' }))).toBe(true);
    });

    test("doesn't apply without the Perk", () => {
      const actor = makeActor({ weaponTraits: ['powerWeapon'] });
      expect(isMultipleTargetsWeapon(actor, weaponEffect({ style: 'melee' }))).toBe(false);
    });

    test("doesn't apply to a non-Power weapon", () => {
      const actor = makeActor({ perkIds: [CHARGE_INTO_BATTLE_ID], weaponTraits: [] });
      expect(isMultipleTargetsWeapon(actor, weaponEffect({ style: 'melee' }))).toBe(false);
    });

    test("doesn't apply to a ranged Power Weapon", () => {
      const actor = makeActor({ perkIds: [CHARGE_INTO_BATTLE_ID], weaponTraits: ['powerWeapon'] });
      expect(isMultipleTargetsWeapon(actor, weaponEffect({ style: 'ranged' }))).toBe(false);
    });

    test("doesn't re-grant it (still just true) when the weapon already has the real trait", () => {
      const actor = makeActor({
        perkIds: [CHARGE_INTO_BATTLE_ID], weaponTraits: ['powerWeapon'], itemAndUpgradeTraits: ['multipleTargets'],
      });
      expect(isMultipleTargetsWeapon(actor, weaponEffect({ style: 'melee' }))).toBe(true);
    });
  });

  describe("Metallikato (Decepticon Directive, General Perk, p.66)", () => {
    const METALLIKATO_ID = "Compendium.essence20.decepticon_directive.Item.ouLZnb7j0kAfCrLx";

    function makeMetallikatoActor({ perkIds = [], isTransformed = false, active = true } = {}) {
      const actor = makeActor({ perkIds });
      actor.system = { isTransformed };
      actor.getFlag = jest.fn((scope, key) => (key == 'metallikatoMultipleTargetsActive' ? active : undefined));
      return actor;
    }

    test("grants it for a melee attack in Bot Mode, with the Perk and the toggle active", () => {
      const actor = makeMetallikatoActor({ perkIds: [METALLIKATO_ID] });
      expect(isMultipleTargetsWeapon(actor, weaponEffect({ style: 'melee' }))).toBe(true);
    });

    test("doesn't apply without the Perk", () => {
      const actor = makeMetallikatoActor();
      expect(isMultipleTargetsWeapon(actor, weaponEffect({ style: 'melee' }))).toBe(false);
    });

    test("doesn't apply while the toggle is inactive", () => {
      const actor = makeMetallikatoActor({ perkIds: [METALLIKATO_ID], active: false });
      expect(isMultipleTargetsWeapon(actor, weaponEffect({ style: 'melee' }))).toBe(false);
    });

    test("doesn't apply in Alt Mode", () => {
      const actor = makeMetallikatoActor({ perkIds: [METALLIKATO_ID], isTransformed: true });
      expect(isMultipleTargetsWeapon(actor, weaponEffect({ style: 'melee' }))).toBe(false);
    });

    test("doesn't apply to a ranged attack", () => {
      const actor = makeMetallikatoActor({ perkIds: [METALLIKATO_ID] });
      expect(isMultipleTargetsWeapon(actor, weaponEffect({ style: 'ranged' }))).toBe(false);
    });
  });

  describe("Box Shot (Quartermaster's Guide to Gear, General Perk, p.28)", () => {
    const BOX_SHOT_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.N8E3QTLUKX6DOoEc";

    function makeBoxShotActor({ perkIds = [], active = true } = {}) {
      const actor = makeActor({ perkIds });
      actor.getFlag = jest.fn((scope, key) => (key == 'boxShotActive' ? active : undefined));
      return actor;
    }

    test("grants it for any attack, with the Perk and the toggle active", () => {
      const actor = makeBoxShotActor({ perkIds: [BOX_SHOT_ID] });
      expect(isMultipleTargetsWeapon(actor, weaponEffect({ style: 'melee' }))).toBe(true);
      expect(isMultipleTargetsWeapon(actor, weaponEffect({ style: 'ranged' }))).toBe(true);
    });

    test("doesn't apply without the Perk, or while the toggle is inactive", () => {
      const actor = makeBoxShotActor();
      expect(isMultipleTargetsWeapon(actor, weaponEffect({ style: 'melee' }))).toBe(false);

      const inactiveActor = makeBoxShotActor({ perkIds: [BOX_SHOT_ID], active: false });
      expect(isMultipleTargetsWeapon(inactiveActor, weaponEffect({ style: 'melee' }))).toBe(false);
    });
  });

  describe("Volley (PR CRB, Pink Ranger, 1st level, p.48)", () => {
    test("grants it for a ranged weapon while active", () => {
      const actor = makeActor();
      actor.getFlag = jest.fn(() => true);
      expect(isMultipleTargetsWeapon(actor, weaponEffect({ style: 'projectile' }))).toBe(true);
    });

    test("doesn't apply to a melee weapon, or while inactive", () => {
      const actor = makeActor();
      actor.getFlag = jest.fn(() => true);
      expect(isMultipleTargetsWeapon(actor, weaponEffect({ style: 'melee' }))).toBe(false);

      const inactiveActor = makeActor();
      expect(isMultipleTargetsWeapon(inactiveActor, weaponEffect({ style: 'projectile' }))).toBe(false);
    });
  });
});
