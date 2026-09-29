import { jest } from '@jest/globals';
import { activatePseudoScience, isPseudoScienceActive } from './pseudo-science.mjs';

function makeActor({ active = false } = {}) {
  // Active = stamped with the current (default 1) mission on the Scene Clock.
  const flags = { pseudoScienceActive: active === true ? { epoch: 1, window: 'mission', count: 1 } : active };
  return {
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value; 
    }),
  };
}

describe("isPseudoScienceActive", () => {
  test("true when the flag is set", () => {
    expect(isPseudoScienceActive(makeActor({ active: true }))).toBe(true);
  });

  test("false when the flag is unset", () => {
    expect(isPseudoScienceActive(makeActor({ active: false }))).toBe(false);
  });

  test("false once the mission it was used in has passed", () => {
    expect(isPseudoScienceActive(makeActor({ active: { epoch: 0, window: 'mission', count: 1 } }))).toBe(false);
  });

  test("a leftover plain flag from before it had a duration reads as expired", () => {
    expect(isPseudoScienceActive(makeActor({ active: 'legacy' }))).toBe(false);
  });
});

describe("activatePseudoScience", () => {
  test("sets the flag", async () => {
    const actor = makeActor();
    await activatePseudoScience(actor);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pseudoScienceActive', { epoch: 1, window: 'mission', count: 1 });
  });
});
