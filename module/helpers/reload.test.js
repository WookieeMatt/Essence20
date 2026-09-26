import {
  clearWeaponReload, hasBurstFiredThisRound, markBurstFiredThisRound, markWeaponNeedsReload, weaponNeedsReload,
} from "./reload.mjs";
import { jest } from '@jest/globals';

function makeWeapon(flagged = false) {
  const flags = { essence20: flagged ? { needsReload: true } : {} };
  return {
    getFlag: jest.fn((scope, key) => flags[scope]?.[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[scope] = { ...flags[scope], [key]: value };
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flags[scope]?.[key];
    }),
  };
}

describe("Reload (GI Joe CRB, Weapon Effects and Traits, p.147)", () => {
  test("weaponNeedsReload is false for a freshly-authored weapon (starts loaded)", () => {
    expect(weaponNeedsReload(makeWeapon())).toBe(false);
  });

  test("weaponNeedsReload is false without a weapon", () => {
    expect(weaponNeedsReload(null)).toBe(false);
    expect(weaponNeedsReload(undefined)).toBe(false);
  });

  test("markWeaponNeedsReload flags the weapon, and weaponNeedsReload then reports it", async () => {
    const weapon = makeWeapon();
    await markWeaponNeedsReload(weapon);
    expect(weapon.setFlag).toHaveBeenCalledWith('essence20', 'needsReload', true);
    expect(weaponNeedsReload(weapon)).toBe(true);
  });

  test("clearWeaponReload unflags an awaiting-reload weapon", async () => {
    const weapon = makeWeapon(true);
    expect(weaponNeedsReload(weapon)).toBe(true);

    await clearWeaponReload(weapon);
    expect(weapon.unsetFlag).toHaveBeenCalledWith('essence20', 'needsReload');
    expect(weaponNeedsReload(weapon)).toBe(false);
  });

  test("markWeaponNeedsReload/clearWeaponReload no-op without a weapon", async () => {
    await expect(markWeaponNeedsReload(null)).resolves.toBeUndefined();
    await expect(clearWeaponReload(undefined)).resolves.toBeUndefined();
  });
});

describe("Burst-Fire (Quartermaster's Guide to Gear p.33)", () => {
  const originalCombat = global.game.combat;

  afterEach(() => {
    global.game.combat = originalCombat;
  });

  test("hasBurstFiredThisRound is false for a weapon that hasn't fired yet this round", () => {
    global.game.combat = { id: 'combat1', round: 1 };
    expect(hasBurstFiredThisRound(makeWeapon())).toBe(false);
  });

  test("markBurstFiredThisRound stamps the current combat/round, and hasBurstFiredThisRound then reports it", async () => {
    global.game.combat = { id: 'combat1', round: 2 };
    const weapon = makeWeapon();

    await markBurstFiredThisRound(weapon);

    expect(weapon.setFlag).toHaveBeenCalledWith('essence20', 'burstFiredThisRound', { combatId: 'combat1', round: 2 });
    expect(hasBurstFiredThisRound(weapon)).toBe(true);
  });

  test("a stamp from a previous round or a different Combat doesn't count", async () => {
    global.game.combat = { id: 'combat1', round: 1 };
    const weapon = makeWeapon();
    await markBurstFiredThisRound(weapon);

    global.game.combat = { id: 'combat1', round: 2 };
    expect(hasBurstFiredThisRound(weapon)).toBe(false);

    global.game.combat = { id: 'combat2', round: 1 };
    expect(hasBurstFiredThisRound(weapon)).toBe(false);
  });

  test("no-ops/reports false outside Combat or without a weapon", async () => {
    global.game.combat = null;
    expect(hasBurstFiredThisRound(makeWeapon())).toBe(false);
    expect(hasBurstFiredThisRound(null)).toBe(false);

    await expect(markBurstFiredThisRound(null)).resolves.toBeUndefined();
    const weapon = makeWeapon();
    await markBurstFiredThisRound(weapon);
    expect(weapon.setFlag).not.toHaveBeenCalled();
  });
});
