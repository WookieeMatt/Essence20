import { DEFAULT_ICON, getDamageTypeIcon, getWeaponEffectDamages } from "./damage-display.mjs";

describe("getDamageTypeIcon", () => {
  test("has an icon for every damage type, and a fallback for anything else", () => {
    expect(getDamageTypeIcon("blunt")).toBe("fa-hammer");
    expect(getDamageTypeIcon("acid")).toBe("fa-flask");
    expect(getDamageTypeIcon("notAType")).toBe(DEFAULT_ICON);
  });
});

describe("getWeaponEffectDamages", () => {
  afterEach(() => {
    fromUuidSync.mockReset();
  });

  test("lists both damages of a weaponEffect Item, main first", () => {
    const effect = { system: { damageValue: 1, damageType: "blunt", secondaryDamage: { type: "acid", value: 1 } } };
    expect(getWeaponEffectDamages(effect)).toEqual([
      { value: 1, type: "blunt", icon: "fa-hammer" },
      { value: 1, type: "acid", icon: "fa-flask" },
    ]);
  });

  test("reads a weapon's summary entry the same way", () => {
    const entry = { damageValue: 2, damageType: "sharp", secondaryDamage: { type: null, value: 0 } };
    expect(getWeaponEffectDamages(entry)).toEqual([{ value: 2, type: "sharp", icon: "fa-sword" }]);
  });

  test("fills in the second damage for an entry saved before it was copied, from the Item it points at", () => {
    fromUuidSync.mockReturnValue({ system: { secondaryDamage: { type: "fire", value: 2 } } });
    const entry = { uuid: "Actor.a.Item.e", damageValue: 1, damageType: "blunt" };
    expect(getWeaponEffectDamages(entry)).toEqual([
      { value: 1, type: "blunt", icon: "fa-hammer" },
      { value: 2, type: "fire", icon: "fa-fire" },
    ]);
    expect(fromUuidSync).toHaveBeenCalledWith("Actor.a.Item.e");
  });

  test("returns nothing for a damage-free effect or no effect at all", () => {
    expect(getWeaponEffectDamages({ system: { damageValue: 0, damageType: "frightened" } })).toEqual([]);
    expect(getWeaponEffectDamages(null)).toEqual([]);
  });
});
