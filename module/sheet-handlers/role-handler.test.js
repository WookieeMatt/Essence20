import { jest } from '@jest/globals';
import { roleValueChange, setRoleValues } from "./role-handler.mjs";

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

describe("setRoleValues - Essences", () => {
  /** A 1st-level character with 3 in each Essence, recording every update it is sent. */
  function makeActor(level = 1) {
    const actor = {
      system: {
        level,
        essences: Object.fromEntries(['strength', 'speed', 'smarts', 'social'].map(e => [e, { max: 3, value: 3 }])),
        powers: { personal: { max: 0 } },
        health: { bonus: 0 },
      },
      items: [],
      flags: { essence20: {} },
      setFlag: jest.fn(),
      update: jest.fn(async (changes) => {
        for (const [path, value] of Object.entries(changes)) {
          const keys = path.split('.');
          const last = keys.pop();
          keys.reduce((node, key) => node[key], actor)[last] = value;
        }
      }),
    };
    return actor;
  }

  // A GI Joe Commando raises Speed and Social at 1st level (and Speed again at 3rd).
  const commando = {
    system: {
      essenceLevels: { strength: [], speed: ['level1', 'level3'], smarts: [], social: ['level1'] },
      powers: { personal: { starting: 0, levels: [] } },
      adjustments: { health: [] },
      skillDie: { isUsed: false, levels: [], specializedLevels: [] },
      items: {},
    },
  };

  // Dropping a Role passes no level. Reading that as "no level" granted nothing at all, while
  // deleting the Role later still took its 1st-level Essences away.
  test("a Role dropped with no level given grants its 1st-level Essences", async () => {
    const actor = makeActor(1);
    await setRoleValues(commando, actor);
    expect(actor.system.essences.speed.max).toBe(4);
    expect(actor.system.essences.social.max).toBe(4);
    expect(actor.system.essences.strength.max).toBe(3);
  });

  test("a level change still uses the level it is given", async () => {
    const actor = makeActor(1);
    await setRoleValues(commando, actor, 3, 1);
    expect(actor.system.essences.speed.max).toBe(4);
    expect(actor.system.essences.social.max).toBe(3);
  });
});
