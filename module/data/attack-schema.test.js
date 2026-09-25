import { attackSchema } from "./attack-schema.mjs";
import { PowerItemData } from "./item/power.mjs";
import { SpellItemData } from "./item/spell.mjs";

// Same reasoning as aoe-schema.test.js's own doc comment: the point is the SHARING between
// SpellItemData and PowerItemData, so helpers/power-attack.mjs (and dice.mjs's own Defense
// pre-select) can treat either type identically - a test that only checked attackSchema() in
// isolation would still pass if someone forgot to spread it into one of the two data models.
const ATTACK_FIELDS = ["damageType", "damageValue", "defenseType", "numTargets"];

describe("attackSchema", () => {
  test("exposes exactly the shared attack fields", () => {
    expect(Object.keys(attackSchema()).sort()).toEqual([...ATTACK_FIELDS].sort());
  });

  test("defaults defenseType/damageType to null, for the non-attack majority", () => {
    expect(attackSchema().defenseType.options.initial).toBeNull();
    expect(attackSchema().damageType.options.initial).toBeNull();
  });

  // Multiple/Multi-Weapon (X) Targets (e.g. Forked Lightning/Wizard Missiles, Finster's
  // Monster-Magic Cookbook p.273-274) - same informational, unenforced field
  // data/item/weapon-effect.mjs's own numTargets already keeps for a weapon.
  test("defaults numTargets to 1, for an ordinary single-target attack", () => {
    expect(attackSchema().numTargets.options.initial).toBe(1);
  });
});

describe.each([
  ["SpellItemData", SpellItemData],
  ["PowerItemData", PowerItemData],
])("%s", (_name, DataModel) => {
  test("spreads the shared attack fields into its schema", () => {
    const schema = DataModel.defineSchema();
    for (const field of ATTACK_FIELDS) {
      expect(schema[field]).toBeDefined();
    }
  });
});
