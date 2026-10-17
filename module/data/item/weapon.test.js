import { WeaponItemData } from "./weapon.mjs";

describe("WeaponItemData.migrateData - legacy transformerMode -> hardpoint", () => {
  test("maps modeBotMode to an External Hardpoint", () => {
    const source = { transformerMode: 'modeBotMode' };
    WeaponItemData.migrateData(source);
    expect(source.hardpoint).toEqual({ type: 'external' });
  });

  test("maps modeAltMode to a hidden Integrated Hardpoint", () => {
    const source = { transformerMode: 'modeAltMode' };
    WeaponItemData.migrateData(source);
    expect(source.hardpoint).toEqual({ type: 'integrated', altModeVisibility: 'hidden' });
  });

  test("maps modeAny to an obvious Integrated Hardpoint", () => {
    const source = { transformerMode: 'modeAny' };
    WeaponItemData.migrateData(source);
    expect(source.hardpoint).toEqual({ type: 'integrated', altModeVisibility: 'obvious' });
  });

  test("leaves an already-set hardpoint untouched", () => {
    const source = { transformerMode: 'modeBotMode', hardpoint: { type: 'integrated', reinforced: true } };
    WeaponItemData.migrateData(source);
    expect(source.hardpoint).toEqual({ type: 'integrated', reinforced: true });
  });

  test("does nothing when there is no transformerMode", () => {
    const source = { name: 'Plain Blaster' };
    WeaponItemData.migrateData(source);
    expect(source.hardpoint).toBeUndefined();
  });

  test("preserves other partial hardpoint fields while filling in type", () => {
    const source = { transformerMode: 'modeAny', hardpoint: { reinforced: true } };
    WeaponItemData.migrateData(source);
    expect(source.hardpoint).toEqual({ reinforced: true, type: 'integrated', altModeVisibility: 'obvious' });
  });
});
