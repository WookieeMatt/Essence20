import { jest } from '@jest/globals';
import { getToxicTerrorShiftDown } from './toxic-terror.mjs';

// No settings registered, so the scene clock reads its default epoch of 1. (The Use button and the unarmed-hit stacking
// are the Perk's own rules - rules/conv14-banked.test.js.)
global.game = {};

function makeTargetActor({ stacks = undefined } = {}) {
  const flagStore = { toxicTerrorStacks: stacks };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
  };
}

describe("getToxicTerrorShiftDown", () => {
  test("0 with no stacks, or no target", () => {
    expect(getToxicTerrorShiftDown(makeTargetActor())).toBe(0);
    expect(getToxicTerrorShiftDown(null)).toBe(0);
  });

  test("this scene's stack count", () => {
    expect(getToxicTerrorShiftDown(makeTargetActor({ stacks: { epoch: 1, window: 'scene', count: 2 } }))).toBe(2);
  });

  test("stacks from an earlier scene, or an old bare number, no longer count", () => {
    expect(getToxicTerrorShiftDown(makeTargetActor({ stacks: { epoch: 0, window: 'scene', count: 3 } }))).toBe(0);
    expect(getToxicTerrorShiftDown(makeTargetActor({ stacks: 3 }))).toBe(0);
  });
});
