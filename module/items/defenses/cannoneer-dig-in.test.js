import { isCannoneerDugIn } from './cannoneer-dig-in.mjs';

const makeActor = active => ({ getFlag: (scope, key) => (scope == 'essence20' && key == 'cannoneerDugIn' ? active : undefined) });

describe("isCannoneerDugIn", () => {
  test("reads the actor flag the item's Use rule writes", () => {
    expect(isCannoneerDugIn(makeActor(true))).toBe(true);
    expect(isCannoneerDugIn(makeActor(false))).toBe(false);
    expect(isCannoneerDugIn(makeActor(undefined))).toBe(false);
    expect(isCannoneerDugIn(null)).toBe(false);
  });
});
