import { isTheToughGetGoingActive } from './the-tough-get-going.mjs';

global.game = { combat: null };

describe("isTheToughGetGoingActive (the Perk's toughGetGoing rule mark)", () => {
  test("active while the mark lasts", () => {
    expect(isTheToughGetGoingActive({ flags: { essence20: { ruleMarks: { toughGetGoing: { by: null, until: null, stamp: null } } } } })).toBe(true);
  });

  test("false with no mark", () => {
    expect(isTheToughGetGoingActive({ flags: {} })).toBe(false);
    expect(isTheToughGetGoingActive(null)).toBe(false);
  });
});
