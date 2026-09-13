import { jest } from '@jest/globals';
import { checkAndMarkSplinterDefense, getHardenedArmorBonus } from './splinter-defense.mjs';

global.game = { combat: null };

describe("getHardenedArmorBonus", () => {
  function makeActor({ level = 8, bonus = {} } = {}) {
    return {
      system: { level },
      _getBaseRolePoints: jest.fn(() => ({
        system: {
          bonus: {
            type: 'defenseBonus',
            defenseBonus: { toughness: true },
            startingValue: 1,
            increaseLevels: ['level4', 'level8', 'level12', 'level16'],
            level20Value: 5,
            ...bonus,
          },
        },
      })),
    };
  }

  test("returns the scaled bonus below level 20", () => {
    // startingValue 1 + 2 increases hit (level4, level8) by the actor's own level 8
    expect(getHardenedArmorBonus(makeActor({ level: 8 }))).toBe(3);
  });

  test("returns level20Value at level 20", () => {
    expect(getHardenedArmorBonus(makeActor({ level: 20 }))).toBe(5);
  });

  test("returns 0 with no base rolePoints item at all", () => {
    const actor = { system: { level: 8 }, _getBaseRolePoints: jest.fn(() => null) };
    expect(getHardenedArmorBonus(actor)).toBe(0);
  });

  test("returns 0 when the base rolePoints item isn't a Toughness defenseBonus", () => {
    const actor = makeActor({ bonus: { defenseBonus: { toughness: false } } });
    expect(getHardenedArmorBonus(actor)).toBe(0);
  });
});

describe("checkAndMarkSplinterDefense", () => {
  function makeTargetActor(flagValue) {
    const flagStore = { splinterDefenseAttackers: flagValue };
    return {
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
    };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1' };
  });

  afterEach(() => {
    game.combat = null;
  });

  test("true (and marks it) the first time a given attacker hits this combat", async () => {
    const target = makeTargetActor(undefined);
    const result = await checkAndMarkSplinterDefense(target, 'attacker1');

    expect(result).toBe(true);
    expect(target.setFlag).toHaveBeenCalledWith(
      'essence20', 'splinterDefenseAttackers', { combatId: 'combat1', attackerIds: ['attacker1'] },
    );
  });

  test("false on a second hit from the SAME attacker this combat", async () => {
    const target = makeTargetActor({ combatId: 'combat1', attackerIds: ['attacker1'] });
    const result = await checkAndMarkSplinterDefense(target, 'attacker1');

    expect(result).toBe(false);
    expect(target.setFlag).not.toHaveBeenCalled();
  });

  test("true for a DIFFERENT attacker in the same combat", async () => {
    const target = makeTargetActor({ combatId: 'combat1', attackerIds: ['attacker1'] });
    const result = await checkAndMarkSplinterDefense(target, 'attacker2');

    expect(result).toBe(true);
    expect(target.setFlag).toHaveBeenCalledWith(
      'essence20', 'splinterDefenseAttackers', { combatId: 'combat1', attackerIds: ['attacker1', 'attacker2'] },
    );
  });

  test("true again for the same attacker once it's a new combat (stale flag ignored)", async () => {
    const target = makeTargetActor({ combatId: 'oldCombat', attackerIds: ['attacker1'] });
    const result = await checkAndMarkSplinterDefense(target, 'attacker1');

    expect(result).toBe(true);
    expect(target.setFlag).toHaveBeenCalledWith(
      'essence20', 'splinterDefenseAttackers', { combatId: 'combat1', attackerIds: ['attacker1'] },
    );
  });

  test("false outside of combat entirely", async () => {
    game.combat = null;
    const target = makeTargetActor(undefined);
    const result = await checkAndMarkSplinterDefense(target, 'attacker1');

    expect(result).toBe(false);
    expect(target.setFlag).not.toHaveBeenCalled();
  });
});
