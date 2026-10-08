import { jest } from '@jest/globals';
import { getVolleyShots } from './volley.mjs';

describe("getVolleyShots", () => {
  function makeVolleyShotsActor({ level = 1 } = {}) {
    return {
      system: { level },
      _getBaseRolePoints: jest.fn(() => ({
        system: { bonus: { type: 'other', startingValue: 2, increaseLevels: ['level5', 'level9', 'level13', 'level17'], level20Value: null } },
      })),
    };
  }

  test("starts at 2 for level 1", () => {
    expect(getVolleyShots(makeVolleyShotsActor({ level: 1 }))).toBe(2);
  });

  test("increases by 1 at each of the 4 increase levels", () => {
    expect(getVolleyShots(makeVolleyShotsActor({ level: 5 }))).toBe(3);
    expect(getVolleyShots(makeVolleyShotsActor({ level: 9 }))).toBe(4);
    expect(getVolleyShots(makeVolleyShotsActor({ level: 13 }))).toBe(5);
    expect(getVolleyShots(makeVolleyShotsActor({ level: 17 }))).toBe(6);
  });

  test("falls through to the normal computation at level 20 since level20Value is unset", () => {
    expect(getVolleyShots(makeVolleyShotsActor({ level: 20 }))).toBe(6);
  });

  test("0 for an actor whose own base rolePoints item isn't Volley Shots", () => {
    const actor = {
      system: { level: 5 },
      _getBaseRolePoints: jest.fn(() => ({ system: { bonus: { type: 'damageBonus' } } })),
    };
    expect(getVolleyShots(actor)).toBe(0);
  });

  test("0 without any base rolePoints item", () => {
    const actor = { system: { level: 5 }, _getBaseRolePoints: jest.fn(() => undefined) };
    expect(getVolleyShots(actor)).toBe(0);
  });
});
