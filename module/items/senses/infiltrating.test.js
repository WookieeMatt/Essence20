import { isInfiltrating } from './infiltrating.mjs';

const makeActor = active => ({ getFlag: (scope, key) => (scope == 'essence20' && key == 'infiltratingActive' ? active : undefined) });

describe("isInfiltrating", () => {
  test("reads the actor flag the item's Use rule writes", () => {
    expect(isInfiltrating(makeActor(true))).toBe(true);
    expect(isInfiltrating(makeActor(false))).toBe(false);
    expect(isInfiltrating(makeActor(undefined))).toBe(false);
    expect(isInfiltrating(null)).toBe(false);
  });
});
