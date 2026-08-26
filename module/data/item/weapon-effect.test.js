import { WeaponEffectItemData } from "./weapon-effect.mjs";

function makeWeaponEffectData(actorType, actorSize, range) {
  const data = Object.create(WeaponEffectItemData.prototype);
  data.range = range;
  data.parent = { // the owning Item document
    parent: actorType ? { type: actorType, system: { size: actorSize } } : null, // the owning Actor document
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
});
