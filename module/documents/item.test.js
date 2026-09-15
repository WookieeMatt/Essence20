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

describe("_preCreate", () => {
  function makeMegaformTraitItem(type = 'coreAbility') {
    const item = makeItem('megaformTrait', { type });
    item.updateSource = jest.fn((data) => Object.assign(item, data));
    return item;
  }

  test("fills in a blank Megaform Trait's Name from its Type", async () => {
    const item = makeMegaformTraitItem('coreBody');
    await item._preCreate({}, {}, 'user1');
    expect(item.updateSource).toHaveBeenCalledWith({ name: CONFIG.E20.megaformTraitTypes.coreBody });
  });

  test("is a no-op for a compendium drop whose Name already matches its Type", async () => {
    const item = makeMegaformTraitItem('move');
    item.name = CONFIG.E20.megaformTraitTypes.move;
    await item._preCreate({ name: item.name }, {}, 'user1');
    expect(item.updateSource).toHaveBeenCalledWith({ name: CONFIG.E20.megaformTraitTypes.move });
  });

  test("doesn't touch Name for other item types", async () => {
    const item = makeItem('gear', {});
    item.updateSource = jest.fn();
    await item._preCreate({}, {}, 'user1');
    expect(item.updateSource).not.toHaveBeenCalledWith(expect.objectContaining({ name: expect.anything() }));
  });
});

describe("_preUpdate", () => {
  function makeMegaformTraitItem(type) {
    return makeItem('megaformTrait', { type });
  }

  test("syncs Name to the new Type when the Type dropdown changes", async () => {
    const item = makeMegaformTraitItem('coreBody');
    const change = { system: { type: 'move' } };
    await item._preUpdate(change, {}, 'user1');
    expect(change.name).toBe(CONFIG.E20.megaformTraitTypes.move);
  });

  test("doesn't touch Name if Type isn't changing", async () => {
    const item = makeMegaformTraitItem('coreBody');
    const change = { system: { essence: 'speed' } };
    await item._preUpdate(change, {}, 'user1');
    expect(change.name).toBeUndefined();
  });

  test("doesn't overwrite a Name explicitly set in the same update", async () => {
    const item = makeMegaformTraitItem('coreBody');
    const change = { name: 'Reinforced Chassis', system: { type: 'move' } };
    await item._preUpdate(change, {}, 'user1');
    expect(change.name).toBe('Reinforced Chassis');
  });

  test("doesn't apply to other item types", async () => {
    const item = makeItem('gear', {});
    const change = { system: { type: 'anything' } };
    await item._preUpdate(change, {}, 'user1');
    expect(change.name).toBeUndefined();
  });
});

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

  describe("Adaptable (GI Joe CRB, Scout Focus, 3rd level, p.91) - doubles Adaptation Points", () => {
    const ADAPTION_POINTS_ID = "Compendium.essence20.gi_joe_crb.Item.tqiseYDXnEngUlvd";
    const ADAPTABLE_ID = "Compendium.essence20.gi_joe_crb.Item.98q6O79HKMPEh4aZ";

    function makeActor({ hasPerk = true } = {}) {
      const perkItems = hasPerk
        ? [{ type: 'perk', flags: { core: { sourceId: ADAPTABLE_ID } } }]
        : [];
      return { system: { level: 10 }, items: { get: () => undefined, find: p => perkItems.find(p) } };
    }

    test("doubles the computed max with the Perk", () => {
      const item = makeItem('rolePoints', {
        resource: { startingMax: 2, increase: 1, increaseLevels: ["5"], level20Value: 99 },
        bonus: { startingValue: null, type: 'none' },
      }, makeActor());
      item.flags = { core: { sourceId: ADAPTION_POINTS_ID } };

      item._prepareRolePoints();

      expect(item.system.resource.max).toBe(6); // (2 + 1) * 2
    });

    test("doesn't double without the Perk", () => {
      const item = makeItem('rolePoints', {
        resource: { startingMax: 2, increase: 1, increaseLevels: ["5"], level20Value: 99 },
        bonus: { startingValue: null, type: 'none' },
      }, makeActor({ hasPerk: false }));
      item.flags = { core: { sourceId: ADAPTION_POINTS_ID } };

      item._prepareRolePoints();

      expect(item.system.resource.max).toBe(3);
    });

    test("doesn't double an unrelated rolePoints item, even with the Perk", () => {
      const item = makeItem('rolePoints', {
        resource: { startingMax: 2, increase: 1, increaseLevels: ["5"], level20Value: 99 },
        bonus: { startingValue: null, type: 'none' },
      }, makeActor());
      item.flags = { core: { sourceId: "Compendium.essence20.gi_joe_crb.Item.otherRolePoints" } };

      item._prepareRolePoints();

      expect(item.system.resource.max).toBe(3);
    });
  });
});

describe("_prepareTotalAvailability", () => {
  const FIELDTEST_ID = "Compendium.essence20.gi_joe_crb.Item.bPMgz1ct8T0kgQ6K";

  function makeActor({ hasPerk = true } = {}) {
    const perkItems = hasPerk
      ? [{ type: 'perk', flags: { core: { sourceId: FIELDTEST_ID } } }]
      : [];
    return { items: { get: () => undefined, find: p => perkItems.find(p) } };
  }

  describe("Fieldtest (GI Joe CRB, Technician, 13th level, p.104)", () => {
    test("shifts availability one step more available with the Perk", () => {
      const item = makeItem('weapon', { availability: 'restricted', items: {} }, makeActor());

      item._prepareTotalAvailability();

      expect(item.system.totalAvailability).toBe('limited');
    });

    test("doesn't shift without the Perk", () => {
      const item = makeItem(
        'weapon', { availability: 'restricted', items: {} }, makeActor({ hasPerk: false }),
      );

      item._prepareTotalAvailability();

      expect(item.system.totalAvailability).toBe('restricted');
    });

    test("clamps at the most-available tier (automatic)", () => {
      const item = makeItem('weapon', { availability: 'standard', items: {} }, makeActor());

      item._prepareTotalAvailability();

      expect(item.system.totalAvailability).toBe('automatic');
    });

    test("applies after combining with an attached Upgrade's own Availability", () => {
      const item = makeItem('weapon', {
        availability: 'standard',
        items: { u1: { type: 'upgrade', availability: 'restricted' } },
      }, makeActor());

      item._prepareTotalAvailability();

      // standard + restricted combines to 'restricted' per the matrix, then Fieldtest shifts
      // that one step more available.
      expect(item.system.totalAvailability).toBe('limited');
    });

    test("no-ops on an item with no owning actor (compendium browsing)", () => {
      const item = makeItem('weapon', { availability: 'restricted', items: {} }, null);

      item._prepareTotalAvailability();

      expect(item.system.totalAvailability).toBe('restricted');
    });
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

  describe("Brutal Might (Enigma of Combination, Pugilist Focus, 3rd level, p.38)", () => {
    const BRUTAL_MIGHT_ID = "Compendium.essence20.enigma_of_combination.Item.l0STCEYBuPMYfzSt";

    function makeMightActor(perkIds = []) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      items.get = jest.fn(() => undefined);
      return {
        system: {
          skills: {
            might: { shift: 'd8', shiftUp: 0, shiftDown: 0, isSpecialized: false },
            brawn: { shift: 'd12', shiftUp: 1, shiftDown: 0, isSpecialized: true },
          },
        },
        items,
      };
    }

    test("rolls Brawn instead of Might when held", async () => {
      const actor = makeMightActor([BRUTAL_MIGHT_ID]);
      const item = makeItem('weaponEffect', { classification: { skill: 'might' } }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ skill: 'brawn', shift: 'd12', shiftUp: 1, isSpecialized: true }),
        actor,
        item,
      );
    });

    test("still rolls Might without the Perk, or leaves a non-Might skill alone with it", async () => {
      const noPerkActor = makeMightActor();
      const mightItem = makeItem('weaponEffect', { classification: { skill: 'might' } }, noPerkActor);
      mightItem._dice.handleSkillItemRoll = jest.fn();
      await mightItem.roll({});
      expect(mightItem._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ skill: 'might', shift: 'd8' }), noPerkActor, mightItem,
      );

      const brawnActor = makeMightActor([BRUTAL_MIGHT_ID]);
      const brawnItem = makeItem('weaponEffect', { classification: { skill: 'brawn' } }, brawnActor);
      brawnItem._dice.handleSkillItemRoll = jest.fn();
      await brawnItem.roll({});
      expect(brawnItem._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ skill: 'brawn', shift: 'd12' }), brawnActor, brawnItem,
      );
    });
  });

  describe("Beastly (Ferocious Fighters, New Influence, p.75) / its own Hang-Up (p.78)", () => {
    const UNARMED_COMBAT_ALTERNATE_EFFECT_1_ID = "Compendium.essence20.gi_joe_crb.Item.gA0rOFD3lmwzkZq4";
    const UNARMED_COMBAT_EFFECT_ID = "Compendium.essence20.gi_joe_crb.Item.eDjovjfygGq8dlQy";
    const BEASTLY_PERK_ID = "Compendium.essence20.ferocious_fighters.Item.3Y0ETFpJUwdUqgUQ";
    const BEASTLY_HANG_UP_ID = "Compendium.essence20.ferocious_fighters.Item.9o0Qbe6lgqNPnm2R";

    function makeBeastlyActor(perkIds = []) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      items.get = jest.fn(() => undefined);
      return {
        system: {
          skills: { finesse: { shift: 'd8', shiftUp: 0, shiftDown: 0, isSpecialized: false } },
        },
        items,
      };
    }

    test("removes the Blunt Alternate Effect's own -1 shiftDown when the Perk is held", async () => {
      const actor = makeBeastlyActor([BEASTLY_PERK_ID]);
      const item = makeItem('weaponEffect', { classification: { skill: 'finesse' }, shiftDown: 1 }, actor);
      item.flags = { core: { sourceId: UNARMED_COMBAT_ALTERNATE_EFFECT_1_ID } };
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 0 }), actor, item,
      );
    });

    test("leaves the Blunt Alternate Effect's -1 in place without the Perk", async () => {
      const actor = makeBeastlyActor();
      const item = makeItem('weaponEffect', { classification: { skill: 'finesse' }, shiftDown: 1 }, actor);
      item.flags = { core: { sourceId: UNARMED_COMBAT_ALTERNATE_EFFECT_1_ID } };
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 1 }), actor, item,
      );
    });

    test("adds a -1 shiftDown to the base Stun effect when the Hang-Up is held", async () => {
      const actor = makeBeastlyActor([BEASTLY_HANG_UP_ID]);
      const item = makeItem('weaponEffect', { classification: { skill: 'finesse' }, shiftDown: 0 }, actor);
      item.flags = { core: { sourceId: UNARMED_COMBAT_EFFECT_ID } };
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 1 }), actor, item,
      );
    });

    test("leaves the base Stun effect's own 0 shiftDown alone without the Hang-Up, or for an unrelated weaponEffect", async () => {
      const actor = makeBeastlyActor();
      const item = makeItem('weaponEffect', { classification: { skill: 'finesse' }, shiftDown: 0 }, actor);
      item.flags = { core: { sourceId: UNARMED_COMBAT_EFFECT_ID } };
      item._dice.handleSkillItemRoll = jest.fn();
      await item.roll({});
      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 0 }), actor, item,
      );

      const perkedActor = makeBeastlyActor([BEASTLY_PERK_ID, BEASTLY_HANG_UP_ID]);
      const unrelatedItem = makeItem('weaponEffect', { classification: { skill: 'finesse' }, shiftDown: 1 }, perkedActor);
      unrelatedItem.flags = { core: { sourceId: "Compendium.essence20.gi_joe_crb.Item.someOtherWeaponEffect" } };
      unrelatedItem._dice.handleSkillItemRoll = jest.fn();
      await unrelatedItem.roll({});
      expect(unrelatedItem._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 1 }), perkedActor, unrelatedItem,
      );
    });
  });

  describe("spell casting cost (Knights of Canterlot, General Perks, p.38)", () => {
    const EFFICIENT_SPELLCASTER_ID = "Compendium.essence20.knights_of_canterlot.Item.eQDQwKQfRQU8obWF";
    const MASTER_SPELLCASTER_ID = "Compendium.essence20.knights_of_canterlot.Item.tEOoAvzj42d20QHu";
    const POWER_CONSERVATIONIST_ID = "Compendium.essence20.knights_of_canterlot.Item.75H9N2YqaSDUhiCQ";
    const POWER_MASTERY_ID = "Compendium.essence20.knights_of_canterlot.Item.qDsWwo5ipmzMMuO4";

    function makeCasterActor(perkIds = [], priorDownshift = 0) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      items.get = jest.fn(() => undefined);
      return {
        system: { skills: { spellcasting: { shift: 'd8', shiftDown: priorDownshift } } },
        items,
        update: jest.fn(),
      };
    }

    test("applies the spell's own cost as a lingering downshift, with no Perks", async () => {
      const actor = makeCasterActor();
      const item = makeItem('spell', { cost: 2, tier: 'elementary' }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 2 }), actor, item,
      );
      expect(actor.update).toHaveBeenCalledWith({ 'system.skills.spellcasting.shiftDown': 2 });
    });

    test("Efficient Spellcaster reduces an Elementary spell's cost by 1", async () => {
      const actor = makeCasterActor([EFFICIENT_SPELLCASTER_ID]);
      const item = makeItem('spell', { cost: 2, tier: 'elementary' }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 1 }), actor, item,
      );
    });

    test("Efficient Spellcaster never reduces cost below 1", async () => {
      const actor = makeCasterActor([EFFICIENT_SPELLCASTER_ID]);
      const item = makeItem('spell', { cost: 1, tier: 'elementary' }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 1 }), actor, item,
      );
    });

    test("Efficient Spellcaster doesn't apply to a Superior spell", async () => {
      const actor = makeCasterActor([EFFICIENT_SPELLCASTER_ID]);
      const item = makeItem('spell', { cost: 2, tier: 'superior' }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 2 }), actor, item,
      );
    });

    test("Master Spellcaster reduces a Superior spell's cost by 1", async () => {
      const actor = makeCasterActor([MASTER_SPELLCASTER_ID]);
      const item = makeItem('spell', { cost: 3, tier: 'superior' }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 2 }), actor, item,
      );
    });

    test("Power Conservationist defers this spell's cost so it doesn't affect the roll, but still lands afterward", async () => {
      const actor = makeCasterActor([POWER_CONSERVATIONIST_ID], 1);
      const item = makeItem('spell', { cost: 2, tier: 'elementary' }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 1 }), actor, item, // only the prior downshift
      );
      expect(actor.update).toHaveBeenCalledWith({ 'system.skills.spellcasting.shiftDown': 3 }); // 1 + 2
    });

    test("Power Mastery defers cost the same way as Power Conservationist", async () => {
      const actor = makeCasterActor([POWER_MASTERY_ID], 0);
      const item = makeItem('spell', { cost: 2, tier: 'elementary' }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 0 }), actor, item,
      );
      expect(actor.update).toHaveBeenCalledWith({ 'system.skills.spellcasting.shiftDown': 2 });
    });

    test("Efficient Spellcaster and Power Conservationist stack (cost reduced, then deferred)", async () => {
      const actor = makeCasterActor([EFFICIENT_SPELLCASTER_ID, POWER_CONSERVATIONIST_ID], 0);
      const item = makeItem('spell', { cost: 2, tier: 'elementary' }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 0 }), actor, item,
      );
      expect(actor.update).toHaveBeenCalledWith({ 'system.skills.spellcasting.shiftDown': 1 }); // cost reduced to 1, deferred
    });

    test("Block Magic adds 1 to the cost of any spell cast while active", async () => {
      const actor = makeCasterActor();
      actor.getFlag = jest.fn((scope, key) => (key == 'blockMagicActive' ? true : undefined));
      const item = makeItem('spell', { cost: 2, tier: 'elementary' }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 3 }), actor, item, // 2 + 1
      );
      expect(actor.update).toHaveBeenCalledWith({ 'system.skills.spellcasting.shiftDown': 3 });
    });

    test("Block Magic doesn't apply while inactive", async () => {
      const actor = makeCasterActor();
      const item = makeItem('spell', { cost: 2, tier: 'elementary' }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 2 }), actor, item,
      );
    });
  });

  describe("Enchant (MLP CRB, Elementary Enchantment spell, p.136)", () => {
    const ENCHANT_ID = "Compendium.essence20.mlp_crb.Item.afYeCCAX0o2Cwf2I";

    function makeEnchantCasterActor() {
      const items = [];
      items.get = jest.fn(() => undefined);
      return {
        system: { skills: { spellcasting: { shift: 'd8', shiftDown: 0 } } },
        items,
        update: jest.fn(),
      };
    }

    function makeEnchantItem(actor) {
      const item = makeItem('spell', { cost: 1, tier: 'elementary' }, actor);
      item.flags = { core: { sourceId: ENCHANT_ID } };
      item._dice.handleSkillItemRoll = jest.fn();
      return item;
    }

    test("prompts for a Skill before rolling and threads the choice through", async () => {
      const actor = makeEnchantCasterActor();
      const item = makeEnchantItem(actor);
      global.foundry.applications.api.DialogV2 = { wait: jest.fn().mockResolvedValue('culture') };

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ isEnchantAttempt: true, enchantSkill: 'culture' }), actor, item,
      );
    });

    test("cancels the whole cast (no roll, no cost) when the picker is cancelled", async () => {
      const actor = makeEnchantCasterActor();
      const item = makeEnchantItem(actor);
      global.foundry.applications.api.DialogV2 = { wait: jest.fn().mockResolvedValue('cancel') };

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).not.toHaveBeenCalled();
      expect(actor.update).not.toHaveBeenCalled();
    });

    test("doesn't prompt for an unrelated spell", async () => {
      const actor = makeEnchantCasterActor();
      const item = makeItem('spell', { cost: 1, tier: 'elementary' }, actor);
      item.flags = { core: { sourceId: "Compendium.essence20.mlp_crb.Item.unrelated" } };
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ isEnchantAttempt: false, enchantSkill: null }), actor, item,
      );
    });
  });

  describe("Explosive Beam (MLP CRB, Superior Beam spell, p.137)", () => {
    const EXPLOSIVE_BEAM_ID = "Compendium.essence20.mlp_crb.Item.VLdz7YvUq2AaUFNz";

    function makeExplosiveBeamCasterActor() {
      const items = [];
      items.get = jest.fn(() => undefined);
      return {
        system: { skills: { spellcasting: { shift: 'd8', shiftDown: 0 } } },
        items,
        update: jest.fn(),
        getActiveTokens: () => [{ document: { disposition: 1 }, center: { x: 0, y: 0 } }],
      };
    }

    test("auto-targets nearby enemies before rolling", async () => {
      const actor = makeExplosiveBeamCasterActor();
      const enemyToken = { id: 'enemy1', document: { disposition: -1 }, actor: {}, center: { x: 10, y: 0 } };
      global.canvas = {
        tokens: { placeables: [...actor.getActiveTokens(), enemyToken], setTargets: jest.fn() },
        grid: { measurePath: () => ({ distance: 10 }) },
      };
      const item = makeItem('spell', { cost: 3, tier: 'superior' }, actor);
      item.flags = { core: { sourceId: EXPLOSIVE_BEAM_ID } };
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(global.canvas.tokens.setTargets).toHaveBeenCalledWith(['enemy1']);
      expect(item._dice.handleSkillItemRoll).toHaveBeenCalled();
    });
  });

  describe("Beam Volley (MLP CRB, Virtuoso Beam spell, p.138)", () => {
    const BEAM_VOLLEY_ID = "Compendium.essence20.mlp_crb.Item.UhkhFqFDYjub1a8k";

    test("auto-targets the closest enemies before rolling", async () => {
      const actorToken = { document: { disposition: 1 }, center: { x: 0, y: 0 } };
      const actor = {
        system: { skills: { spellcasting: { shift: 'd8', shiftDown: 0 } } },
        items: Object.assign([], { get: () => undefined }),
        update: jest.fn(),
        getActiveTokens: () => [actorToken],
      };
      const enemyToken = { id: 'enemy1', document: { disposition: -1 }, actor: {}, center: { x: 10, y: 0 } };
      global.canvas = {
        tokens: { placeables: [actorToken, enemyToken], setTargets: jest.fn() },
        grid: { measurePath: () => ({ distance: 10 }) },
      };
      const item = makeItem('spell', { cost: 4, tier: 'virtuoso' }, actor);
      item.flags = { core: { sourceId: BEAM_VOLLEY_ID } };
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(global.canvas.tokens.setTargets).toHaveBeenCalledWith(['enemy1']);
      expect(item._dice.handleSkillItemRoll).toHaveBeenCalled();
    });
  });

  describe("Bestow Expertise (MLP CRB, Superior Enchantment spell, p.137)", () => {
    const BESTOW_EXPERTISE_ID = "Compendium.essence20.mlp_crb.Item.stwnP4um6j1xxzIo";

    function makeBestowExpertiseCasterActor() {
      const items = [];
      items.get = jest.fn(() => undefined);
      return {
        system: { skills: { spellcasting: { shift: 'd8', shiftDown: 0 } } },
        items,
        update: jest.fn(),
      };
    }

    test("prompts for a Skill and name before rolling and threads the choice through", async () => {
      const actor = makeBestowExpertiseCasterActor();
      const item = makeItem('spell', { cost: 2, tier: 'superior' }, actor);
      item.flags = { core: { sourceId: BESTOW_EXPERTISE_ID } };
      item._dice.handleSkillItemRoll = jest.fn();
      global.foundry.applications.api.DialogV2 = {
        wait: jest.fn().mockResolvedValue({ skill: 'culture', name: 'Ancient Lore' }),
      };

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({
          isBestowExpertiseAttempt: true, bestowExpertiseSkill: 'culture', bestowExpertiseName: 'Ancient Lore',
        }), actor, item,
      );
    });

    test("cancels the whole cast when the picker is cancelled", async () => {
      const actor = makeBestowExpertiseCasterActor();
      const item = makeItem('spell', { cost: 2, tier: 'superior' }, actor);
      item.flags = { core: { sourceId: BESTOW_EXPERTISE_ID } };
      item._dice.handleSkillItemRoll = jest.fn();
      global.foundry.applications.api.DialogV2 = { wait: jest.fn().mockResolvedValue('cancel') };

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).not.toHaveBeenCalled();
      expect(actor.update).not.toHaveBeenCalled();
    });
  });

  describe("Mind Beam (MLP CRB, Virtuoso Beam spell, p.139)", () => {
    const MIND_BEAM_ID = "Compendium.essence20.mlp_crb.Item.gF8otV8Ag9axRp2Z";

    function makeMindBeamCasterActor() {
      const items = [];
      items.get = jest.fn(() => undefined);
      return {
        system: { skills: { spellcasting: { shift: 'd8', shiftDown: 0 } } },
        items,
        update: jest.fn(),
      };
    }

    test("prompts for an effect before rolling and threads the choice through", async () => {
      const actor = makeMindBeamCasterActor();
      const item = makeItem('spell', { cost: 3, tier: 'virtuoso' }, actor);
      item.flags = { core: { sourceId: MIND_BEAM_ID } };
      item._dice.handleSkillItemRoll = jest.fn();
      global.foundry.applications.api.DialogV2 = { wait: jest.fn().mockResolvedValue('stunned') };

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ mindBeamEffect: 'stunned' }), actor, item,
      );
    });

    test("cancels the whole cast when the picker is cancelled", async () => {
      const actor = makeMindBeamCasterActor();
      const item = makeItem('spell', { cost: 3, tier: 'virtuoso' }, actor);
      item.flags = { core: { sourceId: MIND_BEAM_ID } };
      item._dice.handleSkillItemRoll = jest.fn();
      global.foundry.applications.api.DialogV2 = { wait: jest.fn().mockResolvedValue('cancel') };

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).not.toHaveBeenCalled();
      expect(actor.update).not.toHaveBeenCalled();
    });
  });

  describe("Get To Know (Dark Skies Over Equestria, Elementary Utility spell, p.21)", () => {
    const GET_TO_KNOW_ID = "Compendium.essence20.dark_skies_over_equestria.Item.pyRy1dFwuiJpAKj2";

    function makeGetToKnowCasterActor() {
      const items = [];
      items.get = jest.fn(() => undefined);
      return {
        system: { skills: { spellcasting: { shift: 'd8', shiftDown: 0 } } },
        items,
        update: jest.fn(),
      };
    }

    test("prompts for a Skill before rolling and threads the choice through", async () => {
      const actor = makeGetToKnowCasterActor();
      const item = makeItem('spell', { cost: 2, tier: 'elementary' }, actor);
      item.flags = { core: { sourceId: GET_TO_KNOW_ID } };
      item._dice.handleSkillItemRoll = jest.fn();
      global.foundry.applications.api.DialogV2 = { wait: jest.fn().mockResolvedValue('culture') };

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ isGetToKnowAttempt: true, getToKnowSkill: 'culture' }), actor, item,
      );
    });

    test("cancels the whole cast when the picker is cancelled", async () => {
      const actor = makeGetToKnowCasterActor();
      const item = makeItem('spell', { cost: 2, tier: 'elementary' }, actor);
      item.flags = { core: { sourceId: GET_TO_KNOW_ID } };
      item._dice.handleSkillItemRoll = jest.fn();
      global.foundry.applications.api.DialogV2 = { wait: jest.fn().mockResolvedValue('cancel') };

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).not.toHaveBeenCalled();
      expect(actor.update).not.toHaveBeenCalled();
    });
  });
});
