import { jest } from '@jest/globals';
import { isAugmentPowerWeaponActive, activateAugmentPowerWeapon } from './augment-power-weapon.mjs';

function makeActor(active = false) {
  const flagStore = { augmentPowerWeaponActive: active };
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
});

describe("activateAugmentPowerWeapon", () => {
  test("sets the flag and returns true", async () => {
    const actor = makeActor(false);

    const result = await activateAugmentPowerWeapon(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'augmentPowerWeaponActive', true);
  });

  test("no-ops and returns false when already active", async () => {
    const actor = makeActor(true);

    const result = await activateAugmentPowerWeapon(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
