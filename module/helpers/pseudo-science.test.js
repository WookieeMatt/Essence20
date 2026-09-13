import { jest } from '@jest/globals';
import { activatePseudoScience, isPseudoScienceActive } from './pseudo-science.mjs';

function makeActor({ active = false } = {}) {
  const flags = { pseudoScienceActive: active };
  return {
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => { flags[key] = value; }),
  };
}

describe("isPseudoScienceActive", () => {
  test("true when the flag is set", () => {
    expect(isPseudoScienceActive(makeActor({ active: true }))).toBe(true);
  });

  test("false when the flag is unset", () => {
    expect(isPseudoScienceActive(makeActor({ active: false }))).toBe(false);
  });
});

describe("activatePseudoScience", () => {
  test("sets the flag", async () => {
    const actor = makeActor();
    await activatePseudoScience(actor);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pseudoScienceActive', true);
  });
});
