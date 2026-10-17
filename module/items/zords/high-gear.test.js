import { jest } from '@jest/globals';
import { isHighGearActive } from './high-gear.mjs';

// (High Gear's switch on / off, its cost and the doubled Ground Movement are rules on the Feature -
// module/rules/conv17-split2.test.js.)

describe("isHighGearActive", () => {
  test("true once the flag is set", () => {
    expect(isHighGearActive({ getFlag: jest.fn(() => true) })).toBe(true);
  });

  test("false without the flag", () => {
    expect(isHighGearActive({ getFlag: jest.fn(() => false) })).toBe(false);
  });
});
