import { jest } from '@jest/globals';
import { getVolleyShots, isVolleyActive, toggleVolley } from './volley.mjs';

function makeActor({ active = false, power = 1, level = 1 } = {}) {
  const flagStore = { volleyActive: active };
  return {
    system: { powers: { personal: { value: power } }, level },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flagStore[key];
    }),
    update: jest.fn(async ({ 'system.powers.personal.value': value }) => {
      if (value !== undefined) {
        power = value;
      }
    }),
  };
}

describe("isVolleyActive / toggleVolley", () => {
  test("switches on, spending 1 Power", async () => {
    const actor = makeActor({ active: false, power: 1 });
    expect(isVolleyActive(actor)).toBe(false);

    const result = await toggleVolley(actor);

    expect(result).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(isVolleyActive(actor)).toBe(true);
  });

  test("switches off for free", async () => {
    const actor = makeActor({ active: true });

    const result = await toggleVolley(actor);

    expect(result).toBe(false);
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'volleyActive');
  });

  test("returns null without spending anything if unaffordable", async () => {
    const actor = makeActor({ active: false, power: 0 });

    const result = await toggleVolley(actor);

    expect(result).toBeNull();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

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
