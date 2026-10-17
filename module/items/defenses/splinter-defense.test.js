import { jest } from '@jest/globals';
import { getHardenedArmorBonus } from './splinter-defense.mjs';

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
