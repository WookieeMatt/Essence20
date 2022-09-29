import { _isCritIsFumble } from "./chat.mjs";

/* _isCritIsFumble */
describe("_isCritIsFumble", () => {
  test("non-crit, non-fumble", () => {
    const dice = [
      {
        faces: 20,
        values: [10],
      },
    ];
    expect(_isCritIsFumble(dice)).toEqual([false, false]);
  });

  test("crit, non-fumble", () => {
    const dice = [
      {
        faces: 4,
        values: [4],
      },
    ];
    expect(_isCritIsFumble(dice)).toEqual([true, false]);
  });
  
  test("non-crit, fumble", () => {
    const dice = [
      {
        faces: 20,
        values: [1],
      },
    ];
    expect(_isCritIsFumble(dice)).toEqual([false, true]);
  });

  test("crit, fumble", () => {
    const dice = [
      {
        faces: 20,
        values: [1],
      },
      {
        faces: 4,
        values: [4],
      },
    ];
    expect(_isCritIsFumble(dice)).toEqual([true, true]);
  });

  test("d20 and d2 don't crit", () => {
    const dice = [
      {
        faces: 20,
        values: [20],
      },
      {
        faces: 2,
        values: [2],
      },
    ];
    expect(_isCritIsFumble(dice)).toEqual([false, false]);
  });

  test("no dice", () => {
    const dice = [];
    expect(_isCritIsFumble(dice)).toEqual([false, false]);
  });
});
