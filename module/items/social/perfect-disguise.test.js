import { jest } from '@jest/globals';
import { isPerfectDisguiseActive } from './perfect-disguise.mjs';

function makeActor({ active = false } = {}) {
  return {
    getFlag: jest.fn(() => active),
    setFlag: jest.fn(),
  };
}

describe("isPerfectDisguiseActive", () => {
  test("reflects the stored flag", () => {
    expect(isPerfectDisguiseActive(makeActor({ active: true }))).toBe(true);
    expect(isPerfectDisguiseActive(makeActor({ active: false }))).toBe(false);
  });
});
