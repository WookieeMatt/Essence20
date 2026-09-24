import { aoeSchema } from "./aoe-schema.mjs";
import { PowerItemData } from "./item/power.mjs";
import { SpellItemData } from "./item/spell.mjs";
import { WeaponEffectItemData } from "./item/weapon-effect.mjs";

// The point of this file is the SHARING, not the two fields themselves: a weaponEffect, a spell and
// a Power must all expose the identical `shape`/`radius` pair, because helpers/aoe-targeting.mjs
// reads those two names off whatever item it's handed without caring which type it is. A test that
// only checked aoeSchema() in isolation would still pass if someone forgot to spread it into one of
// the three data models, which is exactly the regression worth catching.

const AOE_FIELDS = ["shape", "radius"];

describe("aoeSchema", () => {
  test("exposes exactly the shape and radius fields", () => {
    expect(Object.keys(aoeSchema()).sort()).toEqual([...AOE_FIELDS].sort());
  });

  // Field config is read through `.options` because that's where module/jest.setup.js's own
  // StubDataField parks its constructor argument - these tests assert on what the schema ASKS
  // Foundry for, which is all a unit test can see without a real DataModel.
  test("stores Foundry's own region shape type names, so the value needs no translation", () => {
    // These are the names canvas.regions.placeRegion() itself accepts as a shape `type`.
    expect(aoeSchema().shape.options.choices).toEqual(["circle", "cone", "line", "emanation"]);
  });

  test("defaults to no shape at all, for an ordinary single-target item", () => {
    expect(aoeSchema().shape.options.initial).toBeNull();
  });

  test("allows a fractional radius (Explosive Beam's 15ft diameter is a 7.5ft radius)", () => {
    // makeInt would set integer: true and silently round that to 8, widening the spell.
    expect(aoeSchema().radius.options.integer).toBeFalsy();
  });
});

describe.each([
  ["WeaponEffectItemData", WeaponEffectItemData],
  ["SpellItemData", SpellItemData],
  ["PowerItemData", PowerItemData],
])("%s", (_name, DataModel) => {
  test("spreads the shared AoE fields into its schema", () => {
    const schema = DataModel.defineSchema();
    for (const field of AOE_FIELDS) {
      expect(schema[field]).toBeDefined();
    }
  });
});
