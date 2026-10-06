import { isFrictionlessMovementActive } from './frictionless-movement.mjs';

const makeActor = active => ({ getFlag: (scope, key) => (scope == 'essence20' && key == 'frictionlessMovementActive' ? active : undefined) });

describe("isFrictionlessMovementActive", () => {
  test("reads the actor flag the item's Use rule writes", () => {
    expect(isFrictionlessMovementActive(makeActor(true))).toBe(true);
    expect(isFrictionlessMovementActive(makeActor(false))).toBe(false);
    expect(isFrictionlessMovementActive(makeActor(undefined))).toBe(false);
    expect(isFrictionlessMovementActive(null)).toBe(false);
  });
});
