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
