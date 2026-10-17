import { migrateNonPcStats } from './stat-migration.mjs';

describe("migrateNonPcStats", () => {
  test("back-solves Defenses/Health/Movement from their old flat values, reproducing the same totals", () => {
    const source = {
      system: {
        conditioning: 3,
        essences: {
          strength: { value: 5 }, speed: { value: 4 }, smarts: { value: null }, social: { value: null },
        },
        defenses: {
          toughness: { usesDrivers: false, value: 18 },
          evasion: { usesDrivers: false, value: 15 },
          willpower: { usesDrivers: true, value: 12 },
          cleverness: { usesDrivers: true, value: 10 },
        },
        health: { bonus: 1, max: 20, origin: 0, value: 15 },
        movement: {
          ground: { altMode: 0, base: 40, bonus: 0, morphed: 0, total: 40 },
          aerial: { altMode: 0, base: 0, bonus: 2, morphed: 0, total: 12 },
        },
      },
    };

    migrateNonPcStats(source);

    // Toughness: old flat 18 = base + essence(5) -> base = 13.
    expect(source.system.defenses.toughness.base).toBe(13);
    expect(source.system.defenses.toughness.value).toBeUndefined();
    expect(source.system.defenses.toughness.usesDrivers).toBeUndefined();
    // Evasion: old flat 15 = base + essence(4) -> base = 11.
    expect(source.system.defenses.evasion.base).toBe(11);
    // Willpower/Cleverness: no essence value (null -> 0) -> base = the old flat value directly;
    // usesDrivers is kept (it's meaningful for these two, see makeDefensesFields's own doc).
    expect(source.system.defenses.willpower.base).toBe(12);
    expect(source.system.defenses.willpower.usesDrivers).toBe(true);
    expect(source.system.defenses.cleverness.base).toBe(10);

    // Health: old flat max 20 = origin + conditioning(3) + bonus(1) -> origin = 16.
    expect(source.system.health.origin).toBe(16);

    // Movement: base = old total - bonus, for every type with a real .total.
    expect(source.system.movement.ground.base).toBe(40); // 40 - 0
    expect(source.system.movement.aerial.base).toBe(10); // 12 - 2
  });

  test("is idempotent - does nothing once every Defense already has a .base (already migrated)", () => {
    const source = {
      system: {
        conditioning: 3,
        health: { bonus: 0, max: 20, origin: 16 },
        defenses: {
          toughness: { base: 13, armor: 0, bonus: 0 },
          evasion: { base: 11, armor: 0, bonus: 0 },
          willpower: { base: 12, armor: 0, bonus: 0, usesDrivers: true },
          cleverness: { base: 10, armor: 0, bonus: 0, usesDrivers: true },
        },
        movement: {
          ground: { base: 40, bonus: 0, total: 40 },
        },
      },
    };
    const before = JSON.parse(JSON.stringify(source));

    migrateNonPcStats(source);

    expect(source).toEqual(before);
  });

  test("does nothing when the actor has no defenses at all (e.g. a bare test fixture)", () => {
    const source = { system: {} };
    expect(() => migrateNonPcStats(source)).not.toThrow();
  });

  test("does nothing when the source has no system data", () => {
    expect(() => migrateNonPcStats({})).not.toThrow();
  });
});
