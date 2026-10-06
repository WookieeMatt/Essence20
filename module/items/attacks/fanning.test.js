import {
  STORM_OF_LEAD_ID, adjustFanningShotShift, clampFanningShots, getFanningMaxShots, getFanningShotShifts, isFanningWeapon,
} from "./fanning.mjs";

function makeActor(perkIds = []) {
  return { items: perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } })) };
}

function makeWeapon(traits = ['fanning'], fanningMagnitude = 2) {
  return { system: { traits, fanningMagnitude } };
}

describe("Fanning (X) (A Jump Through Time, New Weapon Traits, p.74)", () => {
  test("isFanningWeapon reads the trait", () => {
    expect(isFanningWeapon(makeWeapon())).toBe(true);
    expect(isFanningWeapon(makeWeapon(['ballistic']))).toBe(false);
    expect(isFanningWeapon(null)).toBe(false);
  });

  describe("getFanningMaxShots", () => {
    test("is the weapon's own X", () => {
      expect(getFanningMaxShots(makeActor(), makeWeapon(['fanning'], 2))).toBe(2);
    });

    test("Storm of Lead adds 1 to X", () => {
      expect(getFanningMaxShots(makeActor([STORM_OF_LEAD_ID]), makeWeapon(['fanning'], 2))).toBe(3);
    });

    test("a Fanning weapon with no X recorded counts as X = 1", () => {
      expect(getFanningMaxShots(makeActor(), makeWeapon(['fanning'], null))).toBe(1);
    });

    test("0 for a weapon without the trait, even with Storm of Lead", () => {
      expect(getFanningMaxShots(makeActor([STORM_OF_LEAD_ID]), makeWeapon(['ballistic']))).toBe(0);
      expect(getFanningMaxShots(makeActor(), null)).toBe(0);
    });
  });

  test("clampFanningShots keeps the request between 0 and the max", () => {
    expect(clampFanningShots(2, 2)).toBe(2);
    expect(clampFanningShots(5, 2)).toBe(2);
    expect(clampFanningShots(-1, 2)).toBe(0);
    expect(clampFanningShots('abc', 2)).toBe(0);
    expect(clampFanningShots(undefined, 2)).toBe(0);
    expect(clampFanningShots(2, 0)).toBe(0);
    expect(clampFanningShots(1.7, 3)).toBe(1);
  });

  describe("getFanningShotShifts", () => {
    test("shot N suffers ↓N", () => {
      expect(getFanningShotShifts(1)).toEqual({ shiftUp: 0, shiftDown: 1 });
      expect(getFanningShotShifts(2)).toEqual({ shiftUp: 0, shiftDown: 2 });
      expect(getFanningShotShifts(3)).toEqual({ shiftUp: 0, shiftDown: 3 });
    });

    test("Storm of Lead's ↑1 applies to the first shot only", () => {
      expect(getFanningShotShifts(1, true)).toEqual({ shiftUp: 1, shiftDown: 1 });
      expect(getFanningShotShifts(2, true)).toEqual({ shiftUp: 0, shiftDown: 2 });
    });
  });

  describe("adjustFanningShotShift", () => {
    test("passes an ordinary shift through unchanged", () => {
      expect(adjustFanningShotShift('d6')).toEqual({ shift: 'd6', autoFail: false });
    });

    test("flags an auto-failing shift so the volley stops", () => {
      expect(adjustFanningShotShift('autoFail')).toEqual({ shift: 'autoFail', autoFail: true });
      expect(adjustFanningShotShift('fumble')).toEqual({ shift: 'fumble', autoFail: true });
    });

    test("an auto-success shift rolls the best rollable pool", () => {
      expect(adjustFanningShotShift('autoSuccess')).toEqual({ shift: '3d6', autoFail: false });
    });

    test("Programmable caps the shot at d12", () => {
      expect(adjustFanningShotShift('2d8', { programmableCapD12: true })).toEqual({ shift: 'd12', autoFail: false });
      expect(adjustFanningShotShift('d8', { programmableCapD12: true })).toEqual({ shift: 'd8', autoFail: false });
    });

    test("Savant Skill rolls a flat d4", () => {
      expect(adjustFanningShotShift('d20', { savant: true })).toEqual({ shift: 'd4', autoFail: false });
    });

    test("Super Specialized steps the shot up once more", () => {
      expect(adjustFanningShotShift('d6', { superSpecialized: true })).toEqual({ shift: 'd8', autoFail: false });
    });
  });
});
