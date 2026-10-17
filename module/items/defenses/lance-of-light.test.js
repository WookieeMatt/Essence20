import { isLanceOfLightActive } from './lance-of-light.mjs';

const makeActor = active => ({ getFlag: (scope, key) => (scope == 'essence20' && key == 'lanceOfLightActive' ? active : undefined) });

describe("isLanceOfLightActive", () => {
  test("reads the actor flag the item's Use rule writes", () => {
    expect(isLanceOfLightActive(makeActor(true))).toBe(true);
    expect(isLanceOfLightActive(makeActor(false))).toBe(false);
    expect(isLanceOfLightActive(makeActor(undefined))).toBe(false);
    expect(isLanceOfLightActive(null)).toBe(false);
  });
});
