import { jest } from '@jest/globals';
import { setPerkAdvancesName } from "./perk-handler.mjs";

function makePerk(type, currentValue) {
  return {
    update: jest.fn(),
    system: { advances: { type, currentValue } },
  };
}

describe("setPerkAdvancesName", () => {
  test.each([
    ['area', 10, "10' x 10'"],
    ['damage', 3, "+3 Damage"],
    ['die', 6, "1d6"],
    ['number', 4, 4],
    ['rerolls', 2, "Reroll 2s"],
    ['upshift', 1, "↑1"],
  ])("formats the '%s' advance type", (type, currentValue, expectedFragment) => {
    const perk = makePerk(type, currentValue);
    setPerkAdvancesName(perk, "Test Perk");
    expect(perk.update).toHaveBeenCalledWith({ name: `Test Perk (${expectedFragment})` });
  });

  test("falls back to a null fragment for an unrecognized advance type", () => {
    const perk = makePerk('unknownType', 5);
    setPerkAdvancesName(perk, "Test Perk");
    expect(perk.update).toHaveBeenCalledWith({ name: "Test Perk (null)" });
  });
});
