import { Essence20Item } from "./item.mjs";
import { jest } from '@jest/globals';
import { getLedger, spend } from "../helpers/action-economy.mjs";
import { invalidateImportedDescriptions } from "../helpers/book-descriptions-store.mjs";

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

  // Obscuring Matrix (Enigma of Combination, Armor Upgrade, p.57): "this bonus is negated while
  // the wearer has the Grappled, Immobilized, Prone, or Restrained Condition."
  describe("Obscuring Matrix (Enigma of Combination, Armor Upgrade, p.57)", () => {
    const OBSCURING_MATRIX_BASIC_ID = "Compendium.essence20.enigma_of_combination.Item.L8ZXz1h0DlCy85UC";
    const OBSCURING_MATRIX_ADVANCED_ID = "Compendium.essence20.enigma_of_combination.Item.HH4q8lx09mV2hhcv";

    function makeArmorItem(statuses, upgradeUuid = OBSCURING_MATRIX_BASIC_ID, value = 2) {
      const actor = { statuses: new Set(statuses) };
      return makeItem('armor', {
        bonusToughness: 0,
        bonusEvasion: 0,
        items: {
          a: { type: 'upgrade', subtype: 'armor', uuid: upgradeUuid, armorBonus: { defense: 'evasion', value } },
        },
      }, actor);
    }

    test.each(['grappled', 'immobilized', 'prone', 'restrained'])(
      "negates the Basic bonus while %s", (status) => {
        const item = makeArmorItem([status]);
        item._prepareArmorBonuses();
        expect(item.system.totalBonusEvasion).toBe(0);
      },
    );

    test("negates the Advanced bonus the same way", () => {
      const item = makeArmorItem(['prone'], OBSCURING_MATRIX_ADVANCED_ID, 4);
      item._prepareArmorBonuses();
      expect(item.system.totalBonusEvasion).toBe(0);
    });

    test("applies normally without any of those Conditions", () => {
      const item = makeArmorItem(['blinded']);
      item._prepareArmorBonuses();
      expect(item.system.totalBonusEvasion).toBe(2);
    });

    test("doesn't negate an unrelated Evasion upgrade sharing the same armor", () => {
      const actor = { statuses: new Set(['prone']) };
      const item = makeItem('armor', {
        bonusToughness: 0,
        bonusEvasion: 0,
        items: {
          a: { type: 'upgrade', subtype: 'armor', uuid: 'Compendium.essence20.other.Item.xxx', armorBonus: { defense: 'evasion', value: 5 } },
        },
      }, actor);
      item._prepareArmorBonuses();
      expect(item.system.totalBonusEvasion).toBe(5);
    });
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

  test("perk items post source/prerequisite/description to chat", async () => {
    const item = makeItem('perk', {
      source: "Core Rulebook", prerequisite: "None", description: "Does a thing",
    });
    await item.roll({});
    expect(global.ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("Does a thing"),
    }));
  });

  test("items without a formula send their description to chat", async () => {
    const item = makeItem('gear', { description: "Just flavor text", formula: "" });
    await item.roll({});
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

  describe("Limited weapon effects (Turbo Thunder Cannon's Energy Attack, Wing Missile Salvo)", () => {
    // Across the Stars Table 3-1.1 p.78: "Energy Attack: 1/Encounter, 4 Energy damage (↓2)".
    const TURBO_THUNDER_CANNON_ENERGY_ATTACK_ID =
      "Compendium.essence20.across_the_stars.Item.Wl7L2wcydXAw9Xei";

    function makeLimitedEffectActor(usedFlags = {}) {
      return {
        system: {
          skills: { targeting: { shift: 'd8', shiftUp: 0, shiftDown: 0, isSpecialized: false } },
        },
        items: Object.assign([], { get: jest.fn(() => undefined) }),
        getFlag: jest.fn((scope, key) => (scope == 'essence20' ? usedFlags[key] : undefined)),
        setFlag: jest.fn(async (scope, key, value) => {
          usedFlags[key] = value;
        }),
      };
    }

    function makeLimitedEffectItem(actor) {
      const item = makeItem('weaponEffect', {
        classification: { skill: 'targeting' }, shiftDown: 2,
      }, actor);
      item.flags = { core: { sourceId: TURBO_THUNDER_CANNON_ENERGY_ATTACK_ID } };
      item._dice.handleSkillItemRoll = jest.fn();
      return item;
    }

    test("rolls normally and marks the flag used when not yet used this encounter", async () => {
      const actor = makeLimitedEffectActor();
      const item = makeLimitedEffectItem(actor);

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalled();
      expect(actor.setFlag).toHaveBeenCalledWith(
        'essence20', 'turboThunderCannonEnergyAttackUsedThisEncounter', expect.objectContaining({ count: 1 }),
      );
    });

    test("blocks the roll and warns instead of marking it used again", async () => {
      const actor = makeLimitedEffectActor({
        turboThunderCannonEnergyAttackUsedThisEncounter: { epoch: 1, window: 'encounter', count: 1 },
      });
      const item = makeLimitedEffectItem(actor);

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).not.toHaveBeenCalled();
      expect(global.ui.notifications.warn).toHaveBeenCalled();
      expect(actor.setFlag).not.toHaveBeenCalled();
    });

    test("leaves an unrelated weaponEffect alone entirely", async () => {
      const actor = makeLimitedEffectActor();
      const item = makeItem('weaponEffect', { classification: { skill: 'targeting' }, shiftDown: 0 }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalled();
      expect(actor.setFlag).not.toHaveBeenCalled();
    });
  });

  describe("Bring It All Down (Decepticon Directive, Demolitionist Focus, 20th level, p.57)", () => {
    const BRING_IT_ALL_DOWN_ID = "Compendium.essence20.decepticon_directive.Item.x4PS0cKR25og3lC0";

    function makeBringItAllDownActor(perkIds = []) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      items.get = jest.fn(() => undefined);
      return {
        system: {
          skills: { technology: { shift: 'd8', shiftUp: 0, shiftDown: 0, isSpecialized: false } },
        },
        items,
        getActiveTokens: () => [{ document: { disposition: 1 }, center: { x: 0, y: 0 } }],
      };
    }

    function stubAoeCanvas(actor) {
      global.canvas = {
        dimensions: { distancePixels: 20 },
        level: { id: 'level1' },
        regions: { placeRegion: jest.fn(async () => null) },
        tokens: { placeables: actor.getActiveTokens(), setTargets: jest.fn() },
      };
      global.game.user = { color: '#000000' };
      global.CONST = { REGION_VISIBILITY: { ALWAYS: 0 } };
    }

    test("prompts and threads the chosen effect through for an explosive attack, with the Perk", async () => {
      const actor = makeBringItAllDownActor([BRING_IT_ALL_DOWN_ID]);
      const item = makeItem('weaponEffect', { classification: { skill: 'technology', style: 'explosive' } }, actor);
      item._dice.handleSkillItemRoll = jest.fn();
      global.foundry.applications.api.DialogV2 = { wait: jest.fn().mockResolvedValue('damage') };

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ bringItAllDownEffect: 'damage' }), actor, item,
      );
    });

    test("never prompts (and threads null) without the Perk", async () => {
      const actor = makeBringItAllDownActor([]);
      const item = makeItem('weaponEffect', { classification: { skill: 'technology', style: 'explosive' } }, actor);
      item._dice.handleSkillItemRoll = jest.fn();
      const waitMock = jest.fn();
      global.foundry.applications.api.DialogV2 = { wait: waitMock };

      await item.roll({});

      expect(waitMock).not.toHaveBeenCalled();
      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ bringItAllDownEffect: null }), actor, item,
      );
    });

    test("never prompts on a non-explosive attack, even with the Perk", async () => {
      const actor = makeBringItAllDownActor([BRING_IT_ALL_DOWN_ID]);
      const item = makeItem('weaponEffect', { classification: { skill: 'technology', style: 'melee' } }, actor);
      item._dice.handleSkillItemRoll = jest.fn();
      const waitMock = jest.fn();
      global.foundry.applications.api.DialogV2 = { wait: waitMock };

      await item.roll({});

      expect(waitMock).not.toHaveBeenCalled();
      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ bringItAllDownEffect: null }), actor, item,
      );
    });

    test("doubles the placed AoE radius when the radius option is chosen", async () => {
      const actor = makeBringItAllDownActor([BRING_IT_ALL_DOWN_ID]);
      stubAoeCanvas(actor);
      const item = makeItem('weaponEffect', {
        classification: { skill: 'technology', style: 'explosive' }, shape: 'circle', radius: 10,
      }, actor);
      item._dice.handleSkillItemRoll = jest.fn();
      global.foundry.applications.api.DialogV2 = { wait: jest.fn().mockResolvedValue('radius') };

      await item.roll({});

      // 10ft doubled to 20ft, at 20px/ft.
      expect(global.canvas.regions.placeRegion).toHaveBeenCalledWith(
        expect.objectContaining({ shapes: [expect.objectContaining({ type: 'circle', radius: 400 })] }),
        expect.objectContaining({ create: false }),
      );
    });

    test("doesn't double the AoE radius when a different option is chosen", async () => {
      const actor = makeBringItAllDownActor([BRING_IT_ALL_DOWN_ID]);
      stubAoeCanvas(actor);
      const item = makeItem('weaponEffect', {
        classification: { skill: 'technology', style: 'explosive' }, shape: 'circle', radius: 10,
      }, actor);
      item._dice.handleSkillItemRoll = jest.fn();
      global.foundry.applications.api.DialogV2 = { wait: jest.fn().mockResolvedValue('shiftUp') };

      await item.roll({});

      expect(global.canvas.regions.placeRegion).toHaveBeenCalledWith(
        expect.objectContaining({ shapes: [expect.objectContaining({ type: 'circle', radius: 200 })] }),
        expect.objectContaining({ create: false }),
      );
    });
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

  describe("Wrestler (Slammer Focus, Sgt Slaughter Sourcebook, 10th level, p.13) - Maneuver shiftDown suppression", () => {
    const WRESTLER_SLAMMER_ID = "Compendium.essence20.sgt_slaughter_sourcebook.Item.ro5hMv4XMhOmANao";

    function makeWrestlerActor(perkIds = []) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      items.get = jest.fn(() => undefined);
      return {
        system: {
          skills: { finesse: { shift: 'd8', shiftUp: 0, shiftDown: 0, isSpecialized: false } },
        },
        items,
      };
    }

    test("suppresses the Maneuver Alternate Effect's own shiftDown on a Melee weaponEffect with the Perk", async () => {
      const actor = makeWrestlerActor([WRESTLER_SLAMMER_ID]);
      const item = makeItem('weaponEffect', {
        classification: { skill: 'finesse', style: 'melee' }, damageType: 'maneuver', shiftDown: 1,
      }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 0 }), actor, item,
      );
    });

    test("leaves the shiftDown in place without the Perk", async () => {
      const actor = makeWrestlerActor();
      const item = makeItem('weaponEffect', {
        classification: { skill: 'finesse', style: 'melee' }, damageType: 'maneuver', shiftDown: 1,
      }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 1 }), actor, item,
      );
    });

    test("leaves the shiftDown in place for a Ranged Maneuver attack (RAW says Melee weapons only)", async () => {
      const actor = makeWrestlerActor([WRESTLER_SLAMMER_ID]);
      const item = makeItem('weaponEffect', {
        classification: { skill: 'finesse', style: 'ranged' }, damageType: 'maneuver', shiftDown: 1,
      }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 1 }), actor, item,
      );
    });

    test("leaves the shiftDown in place for a non-Maneuver Melee attack", async () => {
      const actor = makeWrestlerActor([WRESTLER_SLAMMER_ID]);
      const item = makeItem('weaponEffect', {
        classification: { skill: 'finesse', style: 'melee' }, damageType: 'blunt', shiftDown: 1,
      }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 1 }), actor, item,
      );
    });
  });

  describe("One With Your Weapon (Intercontinental Adventures, Silent Weapons Expert Focus, 10th level, p.13) - Silent Martial Arts shiftDown suppression", () => {
    const ONE_WITH_YOUR_WEAPON_ID = "Compendium.essence20.intercontinental_adventures.Item.RH3AFV38EBAfTvW1";

    function makeActorWithParentWeapon(perkIds, weaponTraits) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      const parentWeapon = { system: { traits: weaponTraits } };
      items.get = jest.fn((id) => (id == 'weapon1' ? parentWeapon : undefined));
      return {
        system: {
          skills: { finesse: { shift: 'd8', shiftUp: 0, shiftDown: 0, isSpecialized: false } },
        },
        items,
      };
    }

    test("suppresses the shiftDown on a Silent + Martial Arts weapon with the Perk", async () => {
      const actor = makeActorWithParentWeapon([ONE_WITH_YOUR_WEAPON_ID], ['martialArts', 'silent']);
      const item = makeItem('weaponEffect', { classification: { skill: 'finesse' }, shiftDown: 1 }, actor);
      item.flags = { essence20: { parentId: 'weapon1' } };
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 0 }), actor, item,
      );
    });

    test("leaves the shiftDown in place without the Perk", async () => {
      const actor = makeActorWithParentWeapon([], ['martialArts', 'silent']);
      const item = makeItem('weaponEffect', { classification: { skill: 'finesse' }, shiftDown: 1 }, actor);
      item.flags = { essence20: { parentId: 'weapon1' } };
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 1 }), actor, item,
      );
    });

    test("leaves the shiftDown in place when the parent weapon is missing only one of the two traits", async () => {
      const actor = makeActorWithParentWeapon([ONE_WITH_YOUR_WEAPON_ID], ['martialArts']);
      const item = makeItem('weaponEffect', { classification: { skill: 'finesse' }, shiftDown: 1 }, actor);
      item.flags = { essence20: { parentId: 'weapon1' } };
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 1 }), actor, item,
      );
    });

    test("leaves the shiftDown in place with no resolvable parent weapon", async () => {
      const actor = makeActorWithParentWeapon([ONE_WITH_YOUR_WEAPON_ID], ['martialArts', 'silent']);
      const item = makeItem('weaponEffect', { classification: { skill: 'finesse' }, shiftDown: 1 }, actor);
      item.flags = { essence20: { parentId: 'someOtherWeapon' } };
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftDown: 1 }), actor, item,
      );
    });
  });

  describe("Accurate (Weapon Effects and Traits, p.106) - weaponEffect-level accurateShiftUp", () => {
    function makeFinesseActor() {
      const items = [];
      items.get = jest.fn(() => undefined);
      return {
        system: { skills: { finesse: { shift: 'd8', shiftUp: 0, shiftDown: 0, isSpecialized: false } } },
        items,
      };
    }

    test("folds the weaponEffect's own accurateShiftUp into the roll's shiftUp", async () => {
      const actor = makeFinesseActor();
      const item = makeItem('weaponEffect', { classification: { skill: 'finesse' }, shiftDown: 0, accurateShiftUp: 1 }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftUp: 1 }), actor, item,
      );
    });

    test("adds nothing without accurateShiftUp set", async () => {
      const actor = makeFinesseActor();
      const item = makeItem('weaponEffect', { classification: { skill: 'finesse' }, shiftDown: 0 }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).toHaveBeenCalledWith(
        expect.objectContaining({ shiftUp: 0 }), actor, item,
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
      actor.getFlag = jest.fn((scope, key) => (key == 'blockMagicActive' ? { epoch: 1, window: 'scene', count: 1 } : undefined));
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

  // An area spell (system.shape set) places a real Region shape via helpers/aoe-targeting.mjs,
  // rather than each such spell carrying its own bespoke auto-targeting helper keyed on its
  // compendium id. Explosive Beam (MLP CRB, Superior Beam spell, p.137 - "a 15ft diameter circle
  // of the chosen space", so a 7.5ft radius) was the last spell to do it the old way and now
  // carries system.shape/radius in the compendium like any other area spell.
  describe("area spells", () => {
    function makeAreaCasterActor() {
      const items = [];
      items.get = jest.fn(() => undefined);
      return {
        system: { skills: { spellcasting: { shift: 'd8', shiftDown: 0 } } },
        items,
        update: jest.fn(),
        getActiveTokens: () => [{ document: { disposition: 1 }, center: { x: 0, y: 0 } }],
      };
    }

    function stubAoeCanvas(actor) {
      // placeRegion resolving null is the "placement cancelled" path - enough to prove the
      // placement was offered without having to stand up a whole RegionDocument.
      global.canvas = {
        dimensions: { distancePixels: 20 },
        level: { id: 'level1' },
        regions: { placeRegion: jest.fn(async () => null) },
        tokens: { placeables: actor.getActiveTokens(), setTargets: jest.fn() },
      };
      global.game.user = { color: '#000000' };
      global.CONST = { REGION_VISIBILITY: { ALWAYS: 0 } };
    }

    test("places an area shape before rolling when the spell has one", async () => {
      const actor = makeAreaCasterActor();
      stubAoeCanvas(actor);
      const item = makeItem('spell', { cost: 3, tier: 'superior', shape: 'circle', radius: 7.5 }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(global.canvas.regions.placeRegion).toHaveBeenCalledWith(
        expect.objectContaining({
          // 7.5ft at 20px per foot - the radius reaches placeRegion already in pixels.
          shapes: [expect.objectContaining({ type: 'circle', radius: 150 })],
        }),
        // Never written to the scene: an Instant-duration area only lives long enough to
        // decide who it caught.
        expect.objectContaining({ create: false }),
      );
      expect(item._dice.handleSkillItemRoll).toHaveBeenCalled();
    });

    test("still rolls when the placement is cancelled", async () => {
      const actor = makeAreaCasterActor();
      stubAoeCanvas(actor);
      const item = makeItem('spell', { cost: 3, tier: 'superior', shape: 'circle', radius: 7.5 }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      // placeAoeTemplate can't tell "cancelled" from "placed, caught nobody", and an area that
      // legitimately catches nobody must still resolve - see the spell branch's own comment.
      expect(item._dice.handleSkillItemRoll).toHaveBeenCalled();
    });

    test("doesn't place anything for an ordinary single-target spell", async () => {
      const actor = makeAreaCasterActor();
      stubAoeCanvas(actor);
      const item = makeItem('spell', { cost: 3, tier: 'superior' }, actor);
      item._dice.handleSkillItemRoll = jest.fn();

      await item.roll({});

      expect(global.canvas.regions.placeRegion).not.toHaveBeenCalled();
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

describe("_rollWithRefund", () => {
  // The action economy spends at the TOP of roll(), long before the roll options dialog opens.
  // Backing out of that dialog is an ordinary thing for a player to do, so the action has to come
  // back - see helpers/action-economy.mjs#refund.
  function makeRollingItem(rollResult) {
    const item = makeItem('weaponEffect', {}, { name: 'Duke' });
    item._dice = { handleSkillItemRoll: jest.fn(async () => rollResult) };
    return item;
  }

  /**
   * A real combatant/actor pair wired into global.game, so the refund can be asserted against the
   * actual ledger rather than a mock. Restores the previous game object afterwards - the rest of
   * this file shares one.
   */
  function withCombat() {
    const flags = {};
    const combatant = {
      tokenId: 'token1',
      isOwner: true,
      group: null,
      getFlag: (scope, key) => flags[key],
      setFlag: async (scope, key, value) => {
        flags[key] = value;
      },
    };
    const actor = {
      name: 'Duke',
      token: { id: 'token1' },
      system: {
        actions: {
          enabled: true,
          standard: { base: 1, bonus: 0, max: 1 },
          move: { base: 1, bonus: 0, max: 1 },
          free: { base: null, bonus: 0, max: null },
          reaction: { base: 1, bonus: 0, max: 1 },
        },
      },
    };

    const previous = global.game;
    global.game = {
      ...previous,
      user: { isGM: false, isActiveGM: false },
      settings: { get: (scope, key) => (key == 'actionEconomyMode' ? 'track' : undefined) },
      combat: { combatants: [combatant], getCombatantsByActor: () => [combatant] },
    };

    return { actor, combatant, restore: () => {
      global.game = previous;
    } };
  }

  test("refunds the spent action when the roll dialog is cancelled", async () => {
    const { actor, restore } = withCombat();
    try {
      const spent = await spend(actor, 'standard', { source: 'Blaster' });
      expect(getLedger(actor).standard).toBe(1);

      const item = makeRollingItem({ cancelled: true });
      await item._rollWithRefund({}, actor, spent);

      expect(getLedger(actor).standard).toBe(0);
    } finally {
      restore();
    }
  });

  test("keeps the spent action when the roll goes through", async () => {
    const { actor, restore } = withCombat();
    try {
      const spent = await spend(actor, 'standard', { source: 'Blaster' });

      const item = makeRollingItem(undefined);
      await item._rollWithRefund({}, actor, spent);

      expect(getLedger(actor).standard).toBe(1);
    } finally {
      restore();
    }
  });


  test("is a no-op when nothing was spent to begin with", async () => {
    const item = makeRollingItem({ cancelled: true });
    await expect(item._rollWithRefund({}, { name: 'Duke' }, null)).resolves.toEqual({ cancelled: true });
  });
});

describe("Reload / Consumable (weaponEffect roll() integration - see helpers/reload.mjs)", () => {
  function makeWeapon(traits = [], { quantity = 1 } = {}) {
    const flags = {};
    return {
      name: 'Blaster',
      isEmbedded: true,
      system: { traits, quantity },
      getFlag: jest.fn((scope, key) => flags[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flags[key] = value; 
      }),
      unsetFlag: jest.fn(async (scope, key) => {
        delete flags[key]; 
      }),
      update: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
    };
  }

  function makeWeaponEffectItem(weapon, actor, rollResult = {}) {
    if (!actor.items || typeof actor.items.find != 'function') {
      actor.items = Object.assign([], { get: jest.fn(() => undefined) });
    }

    if (!actor.system) {
      actor.system = {};
    }

    actor.system.skills = { targeting: { shift: 'd8', shiftUp: 0, shiftDown: 0, isSpecialized: false } };

    const item = makeItem('weaponEffect', { classification: { skill: 'targeting' } }, actor);
    item._dice = {
      handleSkillItemRoll: jest.fn(async () => rollResult),
      _getParentWeapon: jest.fn(() => weapon),
    };
    return item;
  }

  test("Consumable deletes the last copy of the parent weapon after firing", async () => {
    const weapon = makeWeapon(['consumable'], { quantity: 1 });
    const item = makeWeaponEffectItem(weapon, { name: 'Duke' });

    await item.roll({});

    expect(weapon.delete).toHaveBeenCalled();
  });

  test("Consumable decrements quantity instead of deleting when more than one remains", async () => {
    const weapon = makeWeapon(['consumable'], { quantity: 2 });
    const item = makeWeaponEffectItem(weapon, { name: 'Duke' });

    await item.roll({});

    expect(weapon.update).toHaveBeenCalledWith({ 'system.quantity': 1 });
    expect(weapon.delete).not.toHaveBeenCalled();
  });

  test("Consumable still consumes the weapon on a miss ('even if it misses its target')", async () => {
    const weapon = makeWeapon(['consumable'], { quantity: 1 });
    const item = makeWeaponEffectItem(weapon, { name: 'Duke' }, { hit: false });

    await item.roll({});

    expect(weapon.delete).toHaveBeenCalled();
  });

  test("Consumable does nothing when the roll dialog was cancelled", async () => {
    const weapon = makeWeapon(['consumable'], { quantity: 1 });
    const item = makeWeaponEffectItem(weapon, { name: 'Duke' }, { cancelled: true });

    await item.roll({});

    expect(weapon.delete).not.toHaveBeenCalled();
    expect(weapon.update).not.toHaveBeenCalled();
  });

  test("Consumable does nothing for an unembedded (compendium/world) weapon", async () => {
    const weapon = makeWeapon(['consumable'], { quantity: 1 });
    weapon.isEmbedded = false;
    const item = makeWeaponEffectItem(weapon, { name: 'Duke' });

    await item.roll({});

    expect(weapon.delete).not.toHaveBeenCalled();
    expect(weapon.update).not.toHaveBeenCalled();
  });

  test("Reload flags the weapon needing reload after it fires", async () => {
    const weapon = makeWeapon(['reload']);
    const item = makeWeaponEffectItem(weapon, { name: 'Duke' });

    await item.roll({});

    expect(weapon.setFlag).toHaveBeenCalledWith('essence20', 'needsReload', true);
  });

  test("Reload doesn't flag a weapon without the trait", async () => {
    const weapon = makeWeapon([]);
    const item = makeWeaponEffectItem(weapon, { name: 'Duke' });

    await item.roll({});

    expect(weapon.setFlag).not.toHaveBeenCalled();
  });

  /**
   * A real combatant/actor pair wired into global.game, same shape as _rollWithRefund's own
   * withCombat() above, needed here so canSpend()'s Move-action affordability check has a real
   * ledger to read against instead of a mock.
   */
  function withCombat({ moveMax = 1 } = {}) {
    const flags = {};
    const combatant = {
      tokenId: 'token1',
      isOwner: true,
      group: null,
      getFlag: (scope, key) => flags[key],
      setFlag: async (scope, key, value) => {
        flags[key] = value;
      },
    };
    const actor = {
      name: 'Duke',
      token: { id: 'token1' },
      system: {
        actions: {
          enabled: true,
          standard: { base: 1, bonus: 0, max: 1 },
          move: { base: moveMax, bonus: 0, max: moveMax },
          free: { base: null, bonus: 0, max: null },
          reaction: { base: 1, bonus: 0, max: 1 },
        },
      },
    };

    const previous = global.game;
    global.game = {
      ...previous,
      user: { isGM: false, isActiveGM: false },
      settings: { get: (scope, key) => (key == 'actionEconomyMode' ? 'strict' : undefined) },
      combat: { combatants: [combatant], getCombatantsByActor: () => [combatant] },
    };

    return { actor, restore: () => {
      global.game = previous; 
    } };
  }

  test("a weapon already awaiting reload can't fire again without an available Move action", async () => {
    const { actor, restore } = withCombat({ moveMax: 0 });
    try {
      const weapon = makeWeapon(['reload']);
      weapon.getFlag.mockImplementation((scope, key) => (key == 'needsReload' ? true : undefined));
      const item = makeWeaponEffectItem(weapon, actor);

      await item.roll({});

      expect(item._dice.handleSkillItemRoll).not.toHaveBeenCalled();
      expect(weapon.unsetFlag).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  test("a weapon awaiting reload fires once a Move action is spent to clear it", async () => {
    const { actor, restore } = withCombat({ moveMax: 1 });
    try {
      const weapon = makeWeapon(['reload']);
      weapon.getFlag.mockImplementation((scope, key) => (key == 'needsReload' ? true : undefined));
      const item = makeWeaponEffectItem(weapon, actor);

      await item.roll({});

      expect(weapon.unsetFlag).toHaveBeenCalledWith('essence20', 'needsReload');
      expect(item._dice.handleSkillItemRoll).toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});

/* The traits a weapon or armor effectively has: its own, plus what its upgrades grant, minus what
   they take away. Upgrades that REMOVE a trait are rare but real - Ammo Feeder (GI Joe CRB p.151)
   is "Weapon with the Reload trait / The weapon loses the Reload trait". */
describe("_prepareTraits", () => {
  /**
   * A weapon or armor with upgrades attached the way system.items holds them.
   */
  function makeTraitItem(type, traits, upgrades = []) {
    return makeItem(type, {
      traits: [...traits],
      items: Object.fromEntries(upgrades.map((upgrade, index) => [`u${index}`, { type: 'upgrade', ...upgrade }])),
    });
  }

  test("leaves an item with no upgrades with its own traits", () => {
    const item = makeTraitItem('weapon', ['silent', 'reload']);

    item._prepareTraits();

    expect(item.system.itemAndUpgradeTraits).toEqual(['silent', 'reload']);
  });

  test("adds the traits an upgrade grants", () => {
    const item = makeTraitItem('weapon', ['reload'], [{ traits: ['accurate'] }]);

    item._prepareTraits();

    expect(item.system.itemAndUpgradeTraits).toEqual(['reload', 'accurate']);
  });

  test("does not list a trait twice when an upgrade grants one the item already has", () => {
    const item = makeTraitItem('weapon', ['silent'], [{ traits: ['silent'] }]);

    item._prepareTraits();

    expect(item.system.itemAndUpgradeTraits).toEqual(['silent']);
  });

  // Ammo Feeder, the case this was built for.
  test("removes a trait an upgrade takes away", () => {
    const item = makeTraitItem('weapon', ['reload', 'silent'], [{ removedTraits: ['reload'] }]);

    item._prepareTraits();

    expect(item.system.itemAndUpgradeTraits).toEqual(['silent']);
  });

  /* Removal is applied last, so it does not matter which order the upgrades happen to sit in - the
     alternative would make the result depend on attachment order, which nothing in the fiction
     suggests. */
  test("removal beats a grant, whichever order the upgrades are in", () => {
    const granterFirst = makeTraitItem('weapon', [], [{ traits: ['silent'] }, { removedTraits: ['silent'] }]);
    const removerFirst = makeTraitItem('weapon', [], [{ removedTraits: ['silent'] }, { traits: ['silent'] }]);

    granterFirst._prepareTraits();
    removerFirst._prepareTraits();

    expect(granterFirst.system.itemAndUpgradeTraits).toEqual([]);
    expect(removerFirst.system.itemAndUpgradeTraits).toEqual([]);
  });

  test("removing a trait nothing has is harmless", () => {
    const item = makeTraitItem('weapon', ['silent'], [{ removedTraits: ['reload'] }]);

    item._prepareTraits();

    expect(item.system.itemAndUpgradeTraits).toEqual(['silent']);
  });

  test("works on armor too", () => {
    const item = makeTraitItem('armor', ['bulky'], [{ removedTraits: ['bulky'] }, { traits: ['deflective'] }]);

    item._prepareTraits();

    expect(item.system.itemAndUpgradeTraits).toEqual(['deflective']);
  });

  /* Roughly twenty-five checks in dice.mjs ask a weapon `system.traits.includes(...)` directly and
     have always been answered with the combined list. Keeping both names on one array is what gives
     every one of them trait removal without rewriting them - see _prepareTraits' own doc comment. */
  test("system.traits answers the same as itemAndUpgradeTraits", () => {
    const item = makeTraitItem('weapon', ['reload'], [{ traits: ['accurate'], removedTraits: ['reload'] }]);

    item._prepareTraits();

    expect(item.system.traits).toEqual(['accurate']);
    expect(item.system.itemAndUpgradeTraits).toBe(item.system.traits);
  });

  test("ignores attached items that are not upgrades", () => {
    const item = makeItem('weapon', {
      traits: ['silent'],
      items: { e1: { type: 'weaponEffect', traits: ['accurate'], removedTraits: ['silent'] } },
    });

    item._prepareTraits();

    expect(item.system.itemAndUpgradeTraits).toEqual(['silent']);
  });

  test("does nothing for a type that has no upgrade slots", () => {
    const item = makeItem('perk', { traits: ['whatever'] });

    item._prepareTraits();

    expect(item.system.itemAndUpgradeTraits).toBeUndefined();
  });
});

/* A null slot in system.items used to take the whole item's data preparation down with it, since
   _prepareTraits runs inside prepareDerivedData - the weapon lost its derived traits, availability
   and aim shift, not just the bad upgrade. Seen for real when a write failed schema validation and
   left the key behind with nothing in it. */
describe("_prepareTraits with a damaged upgrade slot", () => {
  test("skips a null slot instead of throwing", () => {
    const item = makeItem('weapon', { traits: ['silent'], items: { u1: null } });

    expect(() => item._prepareTraits()).not.toThrow();
    expect(item.system.itemAndUpgradeTraits).toEqual(['silent']);
  });

  test("still reads the good slots either side of a bad one", () => {
    const item = makeItem('weapon', {
      traits: ['reload'],
      items: {
        u1: { type: 'upgrade', traits: ['accurate'] },
        u2: null,
        u3: { type: 'upgrade', removedTraits: ['reload'] },
      },
    });

    item._prepareTraits();

    expect(item.system.itemAndUpgradeTraits).toEqual(['accurate']);
  });
});

describe("_prepareWeaponHands", () => {
  test("falls back to the Size-based default when system.hands is null", () => {
    const item = makeItem('weapon', { hands: null, classification: { size: 'long' } });
    item._prepareWeaponHands();
    expect(item.system.derivedHands).toBe(2); // weaponSizeHands.long
  });

  test("uses an explicit system.hands override when set", () => {
    const item = makeItem('weapon', { hands: 1, classification: { size: 'long' } });
    item._prepareWeaponHands();
    expect(item.system.derivedHands).toBe(1);
  });

  test("respects an explicit 0-hand override (does not treat 0 as unset)", () => {
    const item = makeItem('weapon', { hands: 0, classification: { size: 'heavy' } });
    item._prepareWeaponHands();
    expect(item.system.derivedHands).toBe(0);
  });

  test("integrated-size weapons default to 0 hands", () => {
    const item = makeItem('weapon', { hands: null, classification: { size: 'integrated' } });
    item._prepareWeaponHands();
    expect(item.system.derivedHands).toBe(0);
  });

  test("defaults to 1 when the Size is unrecognized", () => {
    const item = makeItem('weapon', { hands: null, classification: { size: 'bogus' } });
    item._prepareWeaponHands();
    expect(item.system.derivedHands).toBe(1);
  });
});

describe("_prepareHardpointDerived", () => {
  test("integrated Hardpoint forces effectiveSize to 'integrated'", () => {
    const item = makeItem('weapon', {
      classification: { size: 'long' },
      hardpoint: { type: 'integrated', altModeVisibility: 'obvious' },
      requirements: { shift: 'none' },
    });
    item._prepareHardpointDerived();
    expect(item.system.effectiveSize).toBe('integrated');
  });

  test("external Hardpoint keeps the weapon's own size", () => {
    const item = makeItem('weapon', {
      classification: { size: 'long' },
      hardpoint: { type: 'external' },
      requirements: { shift: 'd6' },
    });
    item._prepareHardpointDerived();
    expect(item.system.effectiveSize).toBe('long');
    expect(item.system.effectiveBrawnReq).toBe('d6');
  });

  test("integrated Hardpoint lowers the requirement shift one die (d4 -> d2)", () => {
    const item = makeItem('weapon', {
      classification: { size: 'medium' },
      hardpoint: { type: 'integrated', altModeVisibility: 'hidden' },
      requirements: { shift: 'd4' },
    });
    item._prepareHardpointDerived();
    expect(item.system.effectiveBrawnReq).toBe('d2');
  });

  test("integrated Hardpoint clamps a d2 requirement down to none", () => {
    const item = makeItem('weapon', {
      classification: { size: 'medium' },
      hardpoint: { type: 'integrated', altModeVisibility: 'obvious' },
      requirements: { shift: 'd2' },
    });
    item._prepareHardpointDerived();
    expect(item.system.effectiveBrawnReq).toBe('none');
  });

  test("derivedMode: external -> Bot Mode", () => {
    const item = makeItem('weapon', { classification: {}, hardpoint: { type: 'external' }, requirements: {} });
    item._prepareHardpointDerived();
    expect(item.system.derivedMode).toBe('modeBotMode');
  });

  test("derivedMode: integrated + hidden -> Alt Mode", () => {
    const item = makeItem('weapon', { classification: {}, hardpoint: { type: 'integrated', altModeVisibility: 'hidden' }, requirements: {} });
    item._prepareHardpointDerived();
    expect(item.system.derivedMode).toBe('modeAltMode');
  });

  test("derivedMode: integrated + obvious -> Any Mode", () => {
    const item = makeItem('weapon', { classification: {}, hardpoint: { type: 'integrated', altModeVisibility: 'obvious' }, requirements: {} });
    item._prepareHardpointDerived();
    expect(item.system.derivedMode).toBe('modeAny');
  });

  test("derivedMode: none -> null", () => {
    const item = makeItem('weapon', { classification: {}, hardpoint: { type: 'none' }, requirements: {} });
    item._prepareHardpointDerived();
    expect(item.system.derivedMode).toBeNull();
  });

  test("tolerates a missing hardpoint object entirely", () => {
    const item = makeItem('weapon', { classification: { size: 'light' }, requirements: {} });
    item._prepareHardpointDerived();
    expect(item.system.effectiveSize).toBe('light');
    expect(item.system.effectiveBrawnReq).toBe('none');
    expect(item.system.derivedMode).toBeNull();
  });
});

// Descriptions a GM imported from their own rulebook PDF (helpers/book-descriptions-store.mjs,
// filled by apps/book-description-importer.mjs). The compendium ships these empty because this
// system does not redistribute the publisher's text.
describe("_prepareDescription", () => {
  const UUID = "Compendium.essence20.gi_joe_crb.Item.abc123";

  /**
   * An item with a real _source, which is the whole point of these tests: description is a
   * STORED field, and Foundry does not roll a data model back to its source between
   * preparations, so the check has to read _source rather than the live value.
   */
  function makeDescribedItem({ stored = "", pack = "essence20.gi_joe_crb", sourceId = null } = {}) {
    const item = makeItem("perk", { description: stored });
    item._source = { system: { description: stored } };
    item.pack = pack;
    Object.defineProperty(item, "uuid", { value: UUID, configurable: true });
    item.flags = { core: sourceId ? { sourceId } : {} };
    item._stats = {};
    return item;
  }

  // Mirrors what really happens: the setting changes, and its onChange drops the store cache.
  const withImport = (descriptions) => {
    global.game = {
      settings: {
        get: () => ({ "A Book": { descriptions } }),
      },
    };
    invalidateImportedDescriptions();
  };

  afterEach(() => {
    delete global.game;
  });

  test("fills a blank description from the import", async () => {
    withImport({ [UUID]: "Imported rules text." });
    const item = makeDescribedItem();

    item._prepareDescription();

    expect(item.system.description).toBe("Imported rules text.");
  });

  test("never overwrites a description the GM wrote", async () => {
    withImport({ [UUID]: "Imported rules text." });
    const item = makeDescribedItem({ stored: "<p>My own note.</p>" });

    item._prepareDescription();

    expect(item.system.description).toBe("<p>My own note.</p>");
  });

  // The regression this shape exists for: the first preparation writes the imported text onto
  // system.description, so a second one that consulted the LIVE value would mistake it for the
  // GM's own and refuse to touch it - leaving removed or corrected imports stuck until reload.
  test("a removed import goes away again without a reload", async () => {
    withImport({ [UUID]: "Imported rules text." });
    const item = makeDescribedItem();
    item._prepareDescription();
    expect(item.system.description).toBe("Imported rules text.");

    withImport({});
    item._prepareDescription();

    expect(item.system.description).toBe("");
  });

  test("a copy on an actor resolves through the uuid it came from", async () => {
    withImport({ [UUID]: "Imported rules text." });
    // Not in a pack, and its own uuid is not the compendium one - the sourceId flag is.
    const item = makeDescribedItem({ pack: null, sourceId: UUID });

    item._prepareDescription();

    expect(item.system.description).toBe("Imported rules text.");
  });

  test("an item with no compendium origin at all is left alone", async () => {
    withImport({ [UUID]: "Imported rules text." });
    const item = makeDescribedItem({ pack: null });

    item._prepareDescription();

    expect(item.system.description).toBe("");
  });
});
