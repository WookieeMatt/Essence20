import { Essence20Item } from "./item.mjs";
import { jest } from '@jest/globals';

/**
 * Builds a bare Essence20Item instance with the given type/system/actor,
 * bypassing the real Foundry Item construction pipeline.
 */
function makeItem(type, system, actor = null) {
  const item = new Essence20Item();
  item.type = type;
  item.system = system;
  item.actor = actor;
  item.name = "Test Item";
  item.flags = { essence20: {} };
  // _prepareRolePoints looks up this item's own "parentId" flag (its owning Role, for the Old
  // Hand/additive-Role level-track override) via item.getFlag() and actor.items.get() - none
  // of the fixtures below set a parentId, so these always resolve to "no owning Role found",
  // matching this mock's pre-existing behavior (treated as the base Role's own RolePoints).
  item.getFlag = () => undefined;
  if (actor && !actor.items) {
    actor.items = { get: () => undefined };
  }

  return item;
}

describe("_prepareTraits", () => {
  test("collects traits from upgrade items into itemAndUpgradeTraits for weapons", () => {
    const item = makeItem('weapon', {
      traits: ['reload'],
      items: {
        a1b2c: { type: 'upgrade', traits: ['piercing', 'reload'] },
      },
    });
    item._prepareTraits();
    expect(item.system.itemAndUpgradeTraits.sort()).toEqual(['piercing', 'reload'].sort());
  });

  test("collects traits from upgrade items for armor", () => {
    const item = makeItem('armor', {
      traits: [],
      items: {
        a1b2c: { type: 'upgrade', traits: ['bulky'] },
      },
    });
    item._prepareTraits();
    expect(item.system.itemAndUpgradeTraits).toEqual(['bulky']);
  });

  test("does nothing for item types other than weapon/armor", () => {
    const item = makeItem('gear', { traits: ['foo'] });
    item._prepareTraits();
    expect(item.system.itemAndUpgradeTraits).toBeUndefined();
  });

  test("ignores non-upgrade child items", () => {
    const item = makeItem('weapon', {
      traits: ['reload'],
      items: {
        a1b2c: { type: 'weaponEffect', traits: ['ignored'] },
      },
    });
    item._prepareTraits();
    expect(item.system.itemAndUpgradeTraits).toEqual(['reload']);
  });
});

describe("_prepareArmorBonuses", () => {
  test("sums toughness and evasion bonuses from armor upgrades", () => {
    const item = makeItem('armor', {
      bonusToughness: 1,
      bonusEvasion: 2,
      items: {
        a: { type: 'upgrade', subtype: 'armor', armorBonus: { defense: 'toughness', value: 3 } },
        b: { type: 'upgrade', subtype: 'armor', armorBonus: { defense: 'evasion', value: 4 } },
      },
    });
    item._prepareArmorBonuses();
    expect(item.system.totalBonusToughness).toBe(4);
    expect(item.system.totalBonusEvasion).toBe(6);
  });

  test("ignores upgrades that aren't armor-subtype", () => {
    const item = makeItem('armor', {
      bonusToughness: 1,
      bonusEvasion: 1,
      items: {
        a: { type: 'upgrade', subtype: 'weapon', armorBonus: { defense: 'toughness', value: 99 } },
      },
    });
    item._prepareArmorBonuses();
    expect(item.system.totalBonusToughness).toBe(1);
    expect(item.system.totalBonusEvasion).toBe(1);
  });
});

describe("_getLevelIncreases", () => {
  test("counts how many levels in the array have been reached", () => {
    const item = makeItem('rolePoints', {});
    expect(item._getLevelIncreases(["3", "7", "12"], 8)).toBe(2);
    expect(item._getLevelIncreases(["3", "7", "12"], 20)).toBe(3);
    expect(item._getLevelIncreases(["3", "7", "12"], 1)).toBe(0);
  });

  test("strips non-numeric characters from level labels", () => {
    const item = makeItem('rolePoints', {});
    expect(item._getLevelIncreases(["Level3", "Level7"], 5)).toBe(1);
  });
});

describe("_prepareRolePoints", () => {
  test("does nothing without an actor", () => {
    const item = makeItem('rolePoints', { resource: {}, bonus: {} });
    expect(item._prepareRolePoints()).toBeNull();
  });

  test("computes resource max from startingMax + increases below level 20", () => {
    const item = makeItem('rolePoints', {
      resource: { startingMax: 2, increase: 1, increaseLevels: ["5"], level20Value: 99 },
      bonus: { startingValue: null, type: 'none' },
    }, { system: { level: 10 } });
    item._prepareRolePoints();
    expect(item.system.resource.max).toBe(3); // 2 + 1 increase
  });

  test("uses level20Value for resource max at level 20", () => {
    const item = makeItem('rolePoints', {
      resource: { startingMax: 2, increase: 1, increaseLevels: ["5"], level20Value: 99 },
      bonus: { startingValue: null, type: 'none' },
    }, { system: { level: 20 } });
    item._prepareRolePoints();
    expect(item.system.resource.max).toBe(99);
  });

  test("computes bonus value from startingValue + increases when bonus type isn't none", () => {
    const item = makeItem('rolePoints', {
      resource: { startingMax: null, increaseLevels: [] },
      bonus: {
        startingValue: 1, increase: 2, increaseLevels: ["4", "8"], level20Value: 50, type: 'healthBonus',
      },
    }, { system: { level: 10 } });
    item._prepareRolePoints();
    // startingValue 1 + (2 increases reached * 2)
    expect(item.system.bonus.value).toBe(5);
  });

  test("does not compute bonus value when bonus type is 'none'", () => {
    const item = makeItem('rolePoints', {
      resource: { startingMax: null, increaseLevels: [] },
      bonus: { startingValue: 1, increase: 2, increaseLevels: [], type: 'none' },
    }, { system: { level: 10 } });
    item._prepareRolePoints();
    expect(item.system.bonus.value).toBeUndefined();
  });
});

describe("prepareDerivedData", () => {
  test("dispatches to _prepareArmorBonuses for armor items", () => {
    const item = makeItem('armor', {
      traits: [], items: {}, bonusToughness: 0, bonusEvasion: 0,
    });
    item.prepareDerivedData();
    expect(item.system.totalBonusToughness).toBe(0);
    expect(item.system.totalBonusEvasion).toBe(0);
  });

  test("dispatches to _prepareRolePoints for rolePoints items", () => {
    const item = makeItem('rolePoints', {
      resource: { startingMax: 5, increase: 0, increaseLevels: [] },
      bonus: { startingValue: null, type: 'none' },
    }, { system: { level: 1 } });
    item.prepareDerivedData();
    expect(item.system.resource.max).toBe(5);
  });
});

describe("getRollData", () => {
  test("returns null without an actor", () => {
    const item = makeItem('gear', {});
    expect(item.getRollData()).toBeNull();
  });

  test("merges the actor's roll data with a clone of the item's system data", () => {
    const actor = { getRollData: jest.fn(() => ({ level: 5 })) };
    const item = makeItem('gear', { formula: "1d6" }, actor);
    const rollData = item.getRollData();
    expect(rollData.level).toBe(5);
    expect(rollData.item).toEqual({ formula: "1d6" });
  });
});

describe("roll", () => {
  test("info roll type renders the item's details template to chat", async () => {
    const actor = {};
    const item = makeItem('gear', { description: "A thing" }, actor);
    await item.roll({ rollType: 'info' });
    expect(global.foundry.applications.handlebars.renderTemplate).toHaveBeenCalled();
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("perk items post source/prerequisite/description to chat", () => {
    const item = makeItem('perk', {
      source: "Core Rulebook", prerequisite: "None", description: "Does a thing",
    });
    item.roll({});
    expect(global.ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("Does a thing"),
    }));
  });

  test("items without a formula send their description to chat", () => {
    const item = makeItem('gear', { description: "Just flavor text", formula: "" });
    item.roll({});
    expect(global.ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: "Just flavor text",
    }));
  });

  test("items with a formula create and send a Roll", async () => {
    const actor = { getRollData: jest.fn(() => ({})) };
    const item = makeItem('gear', { formula: "1d20" }, actor);
    const roll = await item.roll({});
    expect(roll).toBeInstanceOf(global.Roll);
    expect(roll.formula).toBe("1d20");
  });

  test("weaponEffect items delegate to the Dice helper and decrement the linked class feature's uses", async () => {
    const classFeature = {
      system: { uses: { value: 3 } },
      update: jest.fn(),
    };
    const actor = {
      system: {
        skills: { strength: { shift: 'd8', shiftUp: 0, shiftDown: 0, isSpecialized: false } },
      },
      // A real (empty) array, not a plain object - actorHasPerk (Mighty Strikes/No Need to Aim's
      // own eligibility check, item.mjs's roll()) needs Array#find, not just the .get() the
      // class-feature lookup below uses.
      items: Object.assign([], { get: jest.fn(() => classFeature) }),
    };
    const item = makeItem('weaponEffect', {
      classification: { skill: 'strength' },
      shiftDown: 1,
      classFeatureId: "abc123",
    }, actor);
    item._dice.handleSkillItemRoll = jest.fn();

    await item.roll({ someDataset: true });

    expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'strength', shiftDown: 1 }),
      actor,
      item,
    );
    expect(classFeature.update).toHaveBeenCalledWith({ ["system.uses.value"]: 2 });
  });
});
