import { WeaponEffectItemData } from "./weapon-effect.mjs";

const ANTLERS_ID = "Compendium.essence20.dark_skies_over_equestria.Item.MIqTCcA1vXERwPYv";

function makeWeaponEffectData(actorType, actorSize, range, {
  style, extendedAttackActive = false, parentId = null, hasAntlers = false,
} = {}) {
  const data = Object.create(WeaponEffectItemData.prototype);
  data.range = range;
  data.classification = { style };
  data.parent = { // the owning Item document
    flags: parentId ? { essence20: { parentId } } : {},
    parent: actorType ? { // the owning Actor document
      type: actorType,
      system: { size: actorSize },
      items: hasAntlers ? [{ type: 'perk', flags: { core: { sourceId: ANTLERS_ID } } }] : [],
      getFlag: (scope, key) => (scope == 'essence20' && key == 'extendedAttackActive' ? extendedAttackActive : undefined),
    } : null,
  };

  return data;
}

describe("WeaponEffectItemData.prepareDerivedData", () => {
  test("sets totalReach from the wielding actor's size when actor type is reach-eligible", () => {
    const data = makeWeaponEffectData('playerCharacter', 'common', { reachMultiplier: null });
    data.prepareDerivedData();
    expect(data.totalReach).toBe(5); // actorReach.common
  });

  test("multiplies actor reach by the weapon's reachMultiplier when greater than 1", () => {
    const data = makeWeaponEffectData('npc', 'huge', { reachMultiplier: 2 });
    data.prepareDerivedData();
    expect(data.totalReach).toBe(20); // actorReach.huge (10) * 2
  });

  test("ignores a reachMultiplier of 1 or less", () => {
    const data = makeWeaponEffectData('vehicle', 'small', { reachMultiplier: 1 });
    data.prepareDerivedData();
    expect(data.totalReach).toBe(2); // actorReach.small
  });

  test("leaves totalReach untouched for actor types that don't use reach", () => {
    const data = makeWeaponEffectData('companion', 'common', { reachMultiplier: null });
    data.prepareDerivedData();
    expect(data.totalReach).toBeUndefined();
  });

  test("leaves totalReach untouched when the item isn't embedded in an actor", () => {
    const data = makeWeaponEffectData(null, null, { reachMultiplier: null });
    data.prepareDerivedData();
    expect(data.totalReach).toBeUndefined();
  });

  describe("Extended Attack (Transformers CRB, Outrider Focus, 13th level, p.90)", () => {
    test("doubles a Melee weapon's Reach while active", () => {
      const data = makeWeaponEffectData('playerCharacter', 'common', { reachMultiplier: null },
        { style: 'melee', extendedAttackActive: true });
      data.prepareDerivedData();
      expect(data.totalReach).toBe(10); // actorReach.common (5) x2
    });

    test("doesn't apply to a non-Melee weapon", () => {
      const data = makeWeaponEffectData('playerCharacter', 'common', { reachMultiplier: null },
        { style: 'projectile', extendedAttackActive: true });
      data.prepareDerivedData();
      expect(data.totalReach).toBe(5);
    });

    test("doesn't apply while inactive", () => {
      const data = makeWeaponEffectData('playerCharacter', 'common', { reachMultiplier: null },
        { style: 'melee', extendedAttackActive: false });
      data.prepareDerivedData();
      expect(data.totalReach).toBe(5);
    });

    test("doesn't stack with an already-doubled permanent reachMultiplier", () => {
      const data = makeWeaponEffectData('npc', 'huge', { reachMultiplier: 3 },
        { style: 'melee', extendedAttackActive: true });
      data.prepareDerivedData();
      expect(data.totalReach).toBe(30); // actorReach.huge (10) x3, not x2
    });
  });

  describe("Antlers (Dark Skies Over Equestria, Metamorphosed Changeling Natural Shape power, p.16)", () => {
    test("doubles reach on an unarmed melee attack with the power", () => {
      const data = makeWeaponEffectData('playerCharacter', 'common', { reachMultiplier: null },
        { style: 'melee', hasAntlers: true });
      data.prepareDerivedData();
      expect(data.totalReach).toBe(10); // actorReach.common (5) x2
    });

    test("doesn't apply when wielding an actual weapon (has a parentId)", () => {
      const data = makeWeaponEffectData('playerCharacter', 'common', { reachMultiplier: null },
        { style: 'melee', hasAntlers: true, parentId: 'weapon1' });
      data.prepareDerivedData();
      expect(data.totalReach).toBe(5);
    });

    test("doesn't apply to a non-Melee attack", () => {
      const data = makeWeaponEffectData('playerCharacter', 'common', { reachMultiplier: null },
        { style: 'projectile', hasAntlers: true });
      data.prepareDerivedData();
      expect(data.totalReach).toBe(5);
    });

    test("doesn't apply without the power", () => {
      const data = makeWeaponEffectData('playerCharacter', 'common', { reachMultiplier: null },
        { style: 'melee', hasAntlers: false });
      data.prepareDerivedData();
      expect(data.totalReach).toBe(5);
    });

    test("doesn't stack with an already-doubled permanent reachMultiplier", () => {
      const data = makeWeaponEffectData('npc', 'huge', { reachMultiplier: 3 },
        { style: 'melee', hasAntlers: true });
      data.prepareDerivedData();
      expect(data.totalReach).toBe(30); // actorReach.huge (10) x3, not x2
    });
  });
});
