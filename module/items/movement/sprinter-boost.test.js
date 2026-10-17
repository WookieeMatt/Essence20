import { isSprinterBoostActive } from './sprinter-boost.mjs';

const makeActor = active => ({ getFlag: (scope, key) => (scope == 'essence20' && key == 'sprinterBoostActive' ? active : undefined) });

describe("isSprinterBoostActive", () => {
  test("reads the actor flag the item's Use rule writes", () => {
    expect(isSprinterBoostActive(makeActor(true))).toBe(true);
    expect(isSprinterBoostActive(makeActor(false))).toBe(false);
    expect(isSprinterBoostActive(makeActor(undefined))).toBe(false);
    expect(isSprinterBoostActive(null)).toBe(false);
  });
});
