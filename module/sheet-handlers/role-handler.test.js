import { roleValueChange } from "./role-handler.mjs";

describe("roleValueChange", () => {
  test("returns 0 when the level hasn't changed", () => {
    expect(roleValueChange(5, ["3", "7"], 5)).toBe(0);
  });

  test("returns 0 for a fresh actor (no lastProcessedLevel) at level 0", () => {
    expect(roleValueChange(0, ["3", "7"])).toBe(0);
  });

  describe("leveling up", () => {
    test("counts every listed level from scratch when there's no lastProcessedLevel", () => {
      expect(roleValueChange(10, ["3", "7", "12"])).toBe(2);
    });

    test("only counts levels reached since lastProcessedLevel", () => {
      // Already processed up to level 5 (which covers "3"); leveling to 10 should only pick up "7"
      expect(roleValueChange(10, ["3", "7", "12"], 5)).toBe(1);
    });

    test("counts nothing when no listed level has been newly reached", () => {
      expect(roleValueChange(6, ["3", "7", "12"], 4)).toBe(0);
    });

    test("strips non-numeric characters from level labels", () => {
      expect(roleValueChange(10, ["Level3", "Level7"])).toBe(2);
    });
  });

  describe("leveling down", () => {
    test("counts levels above the new level that were already reached as a decrease", () => {
      // lastProcessedLevel is 10, so "12" was never actually reached/granted and isn't undone
      expect(roleValueChange(2, ["3", "7", "12"], 10)).toBe(-2);
    });

    test("only counts levels not already below the previously processed level", () => {
      // Was at level 10 (past "3" and "7"), dropping to level 6 should only undo "7"
      expect(roleValueChange(6, ["3", "7", "12"], 10)).toBe(-1);
    });
  });
});
