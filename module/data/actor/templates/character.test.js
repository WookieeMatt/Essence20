import { migrateCharacterData } from "./character.mjs";

describe("migrateCharacterData", () => {
  test("does nothing when there's no essences data", () => {
    const source = {};
    migrateCharacterData(source);
    expect(source).toEqual({});
  });

  test("migrates a bare numeric essence value into a {max, value} object", () => {
    const source = { essences: { strength: 3 } };
    migrateCharacterData(source);
    expect(source.essences.strength).toEqual({ max: 3, value: 3 });
  });

  test("migrates a doubly-nested {max: {max}} edge case down to a flat max/value", () => {
    const source = { essences: { strength: { max: { max: 4 } } } };
    migrateCharacterData(source);
    expect(source.essences.strength.max).toBe(4);
    expect(source.essences.strength.value).toBe(4);
  });

  test("migrates a value left as an unresolved SchemaField (has `required`) down to max/value", () => {
    const source = { essences: { strength: { required: true, max: 5 } } };
    migrateCharacterData(source);
    expect(source.essences.strength.max).toBe(5);
    expect(source.essences.strength.value).toBe(5);
  });

  test("defaults to 0 for the SchemaField edge case when max is missing", () => {
    const source = { essences: { strength: { required: true } } };
    migrateCharacterData(source);
    expect(source.essences.strength.max).toBe(0);
    expect(source.essences.strength.value).toBe(0);
  });

  test("leaves an already-migrated {max, value} essence untouched", () => {
    const source = { essences: { strength: { max: 2, value: 1 } } };
    migrateCharacterData(source);
    expect(source.essences.strength).toEqual({ max: 2, value: 1 });
  });

  test("migrates every essence independently", () => {
    const source = { essences: { strength: 3, speed: { max: 2, value: 2 } } };
    migrateCharacterData(source);
    expect(source.essences.strength).toEqual({ max: 3, value: 3 });
    expect(source.essences.speed).toEqual({ max: 2, value: 2 });
  });
});

describe("migrateCharacterData - legacy Hardpoint counts", () => {
  test("maps externalHardpoints / internalHarpoints into the structured schema", () => {
    const source = { externalHardpoints: 3, internalHarpoints: 4 };
    migrateCharacterData(source);
    expect(source.hardpoints.external.base).toBe(3);
    expect(source.hardpoints.integrated.base).toBe(4);
  });

  test("maps just one side when only that legacy field is present", () => {
    const source = { externalHardpoints: 2 };
    migrateCharacterData(source);
    expect(source.hardpoints.external.base).toBe(2);
    expect(source.hardpoints.integrated).toBeUndefined();
  });

  test("preserves an already-present hardpoints.external.bonus", () => {
    const source = { externalHardpoints: 2, hardpoints: { external: { bonus: 1 } } };
    migrateCharacterData(source);
    expect(source.hardpoints.external).toEqual({ bonus: 1, base: 2 });
  });

  test("does nothing when there are no legacy Hardpoint fields", () => {
    const source = {};
    migrateCharacterData(source);
    expect(source.hardpoints).toBeUndefined();
  });

  test("treats a legacy count of 0 as a real value, not absent", () => {
    const source = { externalHardpoints: 0, internalHarpoints: 0 };
    migrateCharacterData(source);
    expect(source.hardpoints.external.base).toBe(0);
    expect(source.hardpoints.integrated.base).toBe(0);
  });
});
