import { jest } from '@jest/globals';
import {
  parseId,
  getItemsOfTypeFromSystemItems,
  createId,
  _randomId,
  getShiftedSkill,
  updateRoleCache,
} from "./utils.mjs";

describe("parseId", () => {
  test("returns the last segment of a UUID", () => {
    expect(parseId("Actor.abc123.Item.def456")).toBe("def456");
  });

  test("returns the whole string when there's no separator", () => {
    expect(parseId("def456")).toBe("def456");
  });

  test("returns null for an empty string", () => {
    expect(parseId("")).toBeNull();
  });
});

describe("getItemsOfTypeFromSystemItems", () => {
  test("filters items down to the requested type", () => {
    const items = [
      { type: 'weapon', name: 'Sword' },
      { type: 'armor', name: 'Shield Plate' },
      { type: 'weapon', name: 'Bow' },
    ];
    expect(getItemsOfTypeFromSystemItems('weapon', items)).toEqual([
      { type: 'weapon', name: 'Sword' },
      { type: 'weapon', name: 'Bow' },
    ]);
  });

  test("returns an empty array when nothing matches", () => {
    const items = [{ type: 'armor', name: 'Shield Plate' }];
    expect(getItemsOfTypeFromSystemItems('weapon', items)).toEqual([]);
  });
});

describe("_randomId", () => {
  test("produces a deterministic id for a given Math.random() value", () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0);
    expect(_randomId(5)).toBe("86a0");
    Math.random.mockRestore();
  });
});

describe("createId", () => {
  test("retries generation until it finds an id that isn't already taken", () => {
    jest.spyOn(Math, 'random')
      .mockReturnValueOnce(0) // -> "86a0", already taken below
      .mockReturnValueOnce(0.5); // -> "49f0", free

    const items = { "86a0": {} };
    expect(createId(items)).toBe("49f0");
    expect(Math.random).toHaveBeenCalledTimes(2);

    Math.random.mockRestore();
  });
});

describe("getShiftedSkill", () => {
  test("shifts a skill die up the shift list by the given amount", () => {
    const actor = { system: { skills: { athletics: { shift: 'd8' } } } };
    const [newShift, skillString] = getShiftedSkill('athletics', 2, actor);
    expect(newShift).toBe('d12'); // skillShiftList: ..., d12, d10, d8, ... (index 6 - 2 = index 4)
    expect(skillString).toBe('system.skills.athletics.shift');
  });

  test("clamps at the top of the shift list", () => {
    const actor = { system: { skills: { athletics: { shift: '3d6' } } } };
    const [newShift] = getShiftedSkill('athletics', 5, actor);
    expect(newShift).toBe('criticalSuccess');
  });

  test("adds/subtracts numerically for conditioning instead of using the shift list", () => {
    const actor = { system: { conditioning: 3 } };
    const [newShift, skillString] = getShiftedSkill('conditioning', 2, actor);
    expect(newShift).toBe(5);
    expect(skillString).toBe('system.conditioning');
  });
});

describe("updateRoleCache", () => {
  afterEach(() => {
    global.game.packs = [];
  });

  test("caches the concatenated Role documents from every pack onto CONFIG.E20.allPackRoles", async () => {
    const roleA = { name: "Role A" };
    const roleB = { name: "Role B" };
    global.game.packs = [
      { getDocuments: jest.fn(async () => [roleA]) },
      { getDocuments: jest.fn(async () => [roleB]) },
    ];

    await updateRoleCache();

    expect(global.CONFIG.E20.allPackRoles).toEqual([roleA, roleB]);
    for (const pack of global.game.packs) {
      expect(pack.getDocuments).toHaveBeenCalledWith({ type: "role" });
    }
  });
});
