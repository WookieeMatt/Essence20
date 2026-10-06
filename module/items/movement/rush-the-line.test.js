import { isRushTheLineActive } from './rush-the-line.mjs';

const makeActor = active => ({ getFlag: (scope, key) => (scope == 'essence20' && key == 'rushTheLineActive' ? active : undefined) });

describe("isRushTheLineActive", () => {
  test("reads the actor flag the item's Use rule writes", () => {
    expect(isRushTheLineActive(makeActor(true))).toBe(true);
    expect(isRushTheLineActive(makeActor(false))).toBe(false);
    expect(isRushTheLineActive(makeActor(undefined))).toBe(false);
    expect(isRushTheLineActive(null)).toBe(false);
  });
});
