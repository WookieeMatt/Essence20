import { isSkiing } from './skier.mjs';

const makeActor = active => ({ getFlag: (scope, key) => (scope == 'essence20' && key == 'isSkiingActive' ? active : undefined) });

describe("isSkiing", () => {
  test("reads the actor flag the item's Use rule writes", () => {
    expect(isSkiing(makeActor(true))).toBe(true);
    expect(isSkiing(makeActor(false))).toBe(false);
    expect(isSkiing(makeActor(undefined))).toBe(false);
    expect(isSkiing(null)).toBe(false);
  });
});
