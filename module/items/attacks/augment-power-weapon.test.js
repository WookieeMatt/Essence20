import { jest } from '@jest/globals';

const ACTIVE = { epoch: 1, window: 'encounter', count: 1 };
import { isAugmentPowerWeaponActive, activateAugmentPowerWeapon } from './augment-power-weapon.mjs';

function makeActor(active = false) {
  // An active record is a Scene Clock duration stamped with the current (default 1) encounter.
  const flagStore = { augmentPowerWeaponActive: active === true ? ACTIVE : active };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value; 
    }),
  };
}

describe("isAugmentPowerWeaponActive", () => {
  test("false by default", () => {
    expect(isAugmentPowerWeaponActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isAugmentPowerWeaponActive(makeActor(true))).toBe(true);
  });

  test("false once its encounter has passed", () => {
    expect(isAugmentPowerWeaponActive(makeActor({ ...ACTIVE, epoch: 0 }))).toBe(false);
  });

  test("a leftover plain-true flag from before durations reads as expired", () => {
    expect(isAugmentPowerWeaponActive(makeActor('legacy'))).toBe(false);
  });
});

describe("activateAugmentPowerWeapon", () => {
  test("sets the flag and returns true", async () => {
    const actor = makeActor(false);

    const result = await activateAugmentPowerWeapon(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'augmentPowerWeaponActive', expect.objectContaining({ epoch: 1, count: 1 }));
  });

  test("no-ops and returns false when already active", async () => {
    const actor = makeActor(true);

    const result = await activateAugmentPowerWeapon(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
