import { isObserverDisguiseActive } from './observer.mjs';

const makeActor = active => ({ getFlag: (scope, key) => (scope == 'essence20' && key == 'observerDisguiseActive' ? active : undefined) });

describe("isObserverDisguiseActive", () => {
  test("reads the actor flag the item's Use rule writes", () => {
    expect(isObserverDisguiseActive(makeActor(true))).toBe(true);
    expect(isObserverDisguiseActive(makeActor(false))).toBe(false);
    expect(isObserverDisguiseActive(makeActor(undefined))).toBe(false);
    expect(isObserverDisguiseActive(null)).toBe(false);
  });
});
