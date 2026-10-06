import { isGravityOptionalActive } from './gravity-optional.mjs';

const makeActor = active => ({ getFlag: (scope, key) => (scope == 'essence20' && key == 'gravityOptionalActive' ? active : undefined) });

describe("isGravityOptionalActive", () => {
  test("reads the actor flag the item's Use rule writes", () => {
    expect(isGravityOptionalActive(makeActor(true))).toBe(true);
    expect(isGravityOptionalActive(makeActor(false))).toBe(false);
    expect(isGravityOptionalActive(makeActor(undefined))).toBe(false);
    expect(isGravityOptionalActive(null)).toBe(false);
  });
});
