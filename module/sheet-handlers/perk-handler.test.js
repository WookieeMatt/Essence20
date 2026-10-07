import { jest } from '@jest/globals';
import {
  anyGeneralPerkChoices, gameLineOf, getAlreadyChosenExpertiseSkills,
  grantPerkEquipmentMap,
  grantsAnyGeneralPerk,
  onMultiSkillPerkDrop, onPerkDelete, onPerkDrop,
  setPerkAdvancesName, setRoleVatiantPerks,
} from "./perk-handler.mjs";

function makePerk(type, currentValue) {
  return {
    update: jest.fn(),
    system: { advances: { type, currentValue } },
  };
}

describe("setPerkAdvancesName", () => {
  test.each([
    ['area', 10, "10' x 10'"],
    ['damage', 3, "+3 Damage"],
    ['die', 6, "1d6"],
    ['number', 4, 4],
    ['rerolls', 2, "Reroll 2s"],
    ['upshift', 1, "↑1"],
  ])("formats the '%s' advance type", (type, currentValue, expectedFragment) => {
    const perk = makePerk(type, currentValue);
    setPerkAdvancesName(perk, "Test Perk");
    expect(perk.update).toHaveBeenCalledWith({ name: `Test Perk (${expectedFragment})` });
  });

  test("falls back to a null fragment for an unrecognized advance type", () => {
    const perk = makePerk('unknownType', 5);
    setPerkAdvancesName(perk, "Test Perk");
    expect(perk.update).toHaveBeenCalledWith({ name: "Test Perk (null)" });
  });
});

describe("setRoleVatiantPerks (Be A Hero style role-variant container Perks)", () => {
  const VARIANT_PERK_ID = "Compendium.essence20.gi_joe_crb.Item.variantPerk1";

  function makeContainerPerk(overrides = {}) {
    return {
      _id: "container1",
      uuid: "Compendium.essence20.gi_joe_crb.Item.beAHeroContainer",
      system: {
        isRoleVariant: true,
        items: {
          a: { uuid: VARIANT_PERK_ID, role: "Ranger" },
        },
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    global.fromUuid = jest.fn(async (uuid) => ({ uuid, system: { choiceType: 'none' } }));
    global.Item = {
      create: jest.fn(async (doc) => ({
        uuid: doc.uuid,
        system: doc.system,
        setFlag: jest.fn(),
        update: jest.fn(),
      })),
    };
  });

  test("stamps the granted perk's OWN uuid as its compendiumSource, not the container's", async () => {
    const containerPerk = makeContainerPerk();
    const actor = {};

    await setRoleVatiantPerks(containerPerk, { name: "Ranger" }, actor);

    expect(global.Item.create).toHaveBeenCalledTimes(1);
    const createdPerk = await global.Item.create.mock.results[0].value;
    expect(createdPerk.update).toHaveBeenCalledWith({ "_stats.compendiumSource": VARIANT_PERK_ID });
    expect(createdPerk.setFlag).toHaveBeenCalledWith('essence20', 'parentId', containerPerk._id);
  });

  test("skips a sub-perk whose own role doesn't match the actor's current Role", async () => {
    const containerPerk = makeContainerPerk();
    const actor = {};

    await setRoleVatiantPerks(containerPerk, { name: "Commando" }, actor);

    expect(global.Item.create).not.toHaveBeenCalled();
  });
});

describe("grantPerkEquipmentMap (Perks whose compendium grant map IS the mechanic)", () => {
  const HAMMER_ID = "Compendium.essence20.wtnv_citizens_guide.Item.kUdy8xJTH8mVmOb5";
  const NOTEBOOK_ID = "Compendium.essence20.wtnv_citizens_guide.Item.someGearUuid00";
  const SUB_PERK_ID = "Compendium.essence20.wtnv_citizens_guide.Item.someSubPerk0000";

  function makeActor(items = []) {
    items.some = Array.prototype.some.bind(items);
    return { items };
  }

  function makePerk(entries) {
    return { system: { items: entries } };
  }

  beforeEach(() => {
    global.Item = { create: jest.fn(async () => ({})) };
    global.fromUuid = jest.fn(async (uuid) => ({ uuid }));
  });

  // Hammer Space's own authored map, which nothing ever delivered before this.
  test("grants a weapon the map declares", async () => {
    const actor = makeActor([]);

    await grantPerkEquipmentMap(actor, makePerk({ hms1: { uuid: HAMMER_ID, type: 'weapon' } }));

    expect(global.Item.create).toHaveBeenCalledWith({ uuid: HAMMER_ID }, { parent: actor });
  });

  test("grants gear too, not just weapons", async () => {
    const actor = makeActor([]);

    await grantPerkEquipmentMap(actor, makePerk({ cn1: { uuid: NOTEBOOK_ID, type: 'gear' } }));

    expect(global.Item.create).toHaveBeenCalledWith({ uuid: NOTEBOOK_ID }, { parent: actor });
  });

  // Team Perk: In Space (Through the Shattered Grid, p.26): "you gain the Galaxy Glider Grid
  // Power" - a power-type map entry, same shape as Nanoflage's own Mimic grant
  // (grantNanoflageMimic), just authored in the map instead of hardcoded.
  test("grants a power too, not just weapons/gear", async () => {
    const actor = makeActor([]);
    const GALAXY_GLIDER_ID = "Compendium.essence20.across_the_stars.Item.tDuSm78HrB37tryx";

    await grantPerkEquipmentMap(actor, makePerk({ gP5L: { uuid: GALAXY_GLIDER_ID, type: 'power' } }));

    expect(global.Item.create).toHaveBeenCalledWith({ uuid: GALAXY_GLIDER_ID }, { parent: actor });
  });

  // Royal Griffon Defense Force (Story of the Seasons, p.131): "the griffon has a suit of armor
  // that grants +3 to Toughness" - an armor-type map entry, same shape as Battlizer Access's own
  // armor grant (grantBattlizerAccess), just authored in the map instead of hardcoded.
  test("grants an armor too, not just weapons/gear/power", async () => {
    const actor = makeActor([]);
    const GDF_ARMOR_ID = "Compendium.essence20.story_of_the_seasons.Item.oz1HkbZ9vL6oFdUY";

    await grantPerkEquipmentMap(actor, makePerk({ gdfa: { uuid: GDF_ARMOR_ID, type: 'armor' } }));

    expect(global.Item.create).toHaveBeenCalledWith({ uuid: GDF_ARMOR_ID }, { parent: actor });
  });

  // TF CRB Keen Sensors: "you also gain the Acute Sense Perk" - an unconditional grant with no
  // other path resolving it, so it's granted here exactly like a weapon/gear entry.
  test("grants a plain perk entry", async () => {
    const actor = makeActor([]);

    await grantPerkEquipmentMap(actor, makePerk({ p1: { uuid: SUB_PERK_ID, type: 'perk' } }));

    expect(global.Item.create).toHaveBeenCalledWith({ uuid: SUB_PERK_ID }, { parent: actor });
  });

  // hasChoice Perks (e.g. Mutant Beast, Hunter's Prowess) author their own `perk` map as a
  // picker's option pool - choices-selector.mjs's own 'perks' selectionType grants exactly the
  // ONE the player picked. Sweeping every option here too would hand out all of them.
  test("ignores perk entries when the Perk itself is a hasChoice picker", async () => {
    const actor = makeActor([]);
    const perk = makePerk({ p1: { uuid: SUB_PERK_ID, type: 'perk' } });
    perk.system.hasChoice = true;

    await grantPerkEquipmentMap(actor, perk);

    expect(global.Item.create).not.toHaveBeenCalled();
  });

  // isRoleVariant Faction Perks (e.g. Be A Hero, Be Ruthless, Cybertronian Perk) role-key each
  // entry and are already granted, one at a time, by role-handler.mjs's own addFactionPerks()
  // when a matching Role is dropped - sweeping them here too would double-grant.
  test("ignores perk entries when the Perk itself is an isRoleVariant Faction Perk", async () => {
    const actor = makeActor([]);
    const perk = makePerk({ p1: { uuid: SUB_PERK_ID, type: 'perk', role: 'Commando' } });
    perk.system.isRoleVariant = true;

    await grantPerkEquipmentMap(actor, perk);

    expect(global.Item.create).not.toHaveBeenCalled();
  });

  test("is idempotent when the actor already holds the item", async () => {
    const actor = makeActor([{ type: 'weapon', flags: { core: { sourceId: HAMMER_ID } } }]);

    await grantPerkEquipmentMap(actor, makePerk({ hms1: { uuid: HAMMER_ID, type: 'weapon' } }));

    expect(global.Item.create).not.toHaveBeenCalled();
  });

  test("no-ops for a Perk with no grant map at all", async () => {
    const actor = makeActor([]);

    await grantPerkEquipmentMap(actor, { system: {} });
    await grantPerkEquipmentMap(actor, undefined);

    expect(global.Item.create).not.toHaveBeenCalled();
  });

  // Regression guard for a bug this whole cluster shipped with: Item.create copies ONLY the parent
  // Item, but a weapon's weaponEffects are separate Items on the actor, so an integrated weapon
  // granted here used to arrive with nothing to roll. Found while granting Screech (Story of the
  // Seasons, p.131); it silently affected every weapon ever handed out this way.
  describe("a granted weapon brings its own weaponEffects with it", () => {
    const SCREECH_WEAPON_ID = "Compendium.essence20.story_of_the_seasons.Item.kvGkqTvE66u4fGhY";
    const SCREECH_EFFECT_ID = "Compendium.essence20.story_of_the_seasons.Item.JsgKy9KBBeMPIMrG";

    function makeCreated(data) {
      return {
        ...data,
        _id: 'created1',
        uuid: data.uuid,
        img: 'icon.svg',
        name: 'Screech',
        system: data.system ?? {},
        setFlag: jest.fn(),
        update: jest.fn(),
      };
    }

    // Saved and restored rather than cleared: a shared foundry global is set up for the whole
    // file elsewhere, and blanking it in afterEach broke an unrelated test that runs later.
    let savedFoundry;

    beforeEach(() => {
      savedFoundry = global.foundry;
      global.foundry = { data: { operators: { ForcedDeletion: class {} } } };
      global.fromUuid = jest.fn(async (uuid) => (uuid == SCREECH_WEAPON_ID
        ? { uuid, type: 'weapon', system: { items: { eff1: { uuid: SCREECH_EFFECT_ID, type: 'weaponEffect' } } } }
        : { uuid, type: 'weaponEffect', system: { description: '' } }));
      global.Item = { create: jest.fn(async (data) => makeCreated(data)) };
    });

    afterEach(() => {
      global.foundry = savedFoundry;
    });

    test("creates the weaponEffect alongside the weapon itself", async () => {
      const actor = makeActor([]);
      actor.system = { level: 1 };

      await grantPerkEquipmentMap(actor, makePerk({ Scr1: { uuid: SCREECH_WEAPON_ID, type: 'weapon' } }));

      expect(global.Item.create).toHaveBeenCalledWith(
        expect.objectContaining({ uuid: SCREECH_WEAPON_ID }), { parent: actor },
      );
      expect(global.Item.create).toHaveBeenCalledWith(
        expect.objectContaining({ uuid: SCREECH_EFFECT_ID }), { parent: actor },
      );
    });

    test("a gear grant copies nothing extra - only weapons/armor/shields carry attachments", async () => {
      const GEAR_ID = "Compendium.essence20.story_of_the_seasons.Item.plainGear00000";
      global.fromUuid = jest.fn(async (uuid) => ({ uuid, type: 'gear', system: {} }));
      const actor = makeActor([]);
      actor.system = { level: 1 };

      await grantPerkEquipmentMap(actor, makePerk({ g1: { uuid: GEAR_ID, type: 'gear' } }));

      expect(global.Item.create).toHaveBeenCalledTimes(1);
    });
  });
});

// (Combiner Specialization's pick / +1 Health is an 'added' Trigger rule on the Perk - rules/conv14-systems.test.js.)

describe("onPerkDrop", () => {
  function makeActor(skillShiftUp = 0) {
    return {
      items: [], // empty - skips the "already taken" scan, out of scope for this branch's tests
      system: { skills: { athletics: { shiftUp: skillShiftUp } } },
      update: jest.fn(),
    };
  }

  function makePerkItem({ value = 2, name = 'Expertise' } = {}) {
    return {
      name,
      uuid: "Compendium.essence20.gi_joe_crb.Item.F9kOLys1Iu4UOg22",
      system: { hasChoice: true, value, isRoleVariant: false, advances: { canAdvance: false } },
      update: jest.fn(),
    };
  }

  // e.g. Expertise (GI Joe CRB p.72): "Choose two skills. You're an expert in each, gaining
  // [2 upshifts] when using them." Regression coverage for a live bug report - this branch used
  // to write perk.system.value into the skill's flat .modifier instead of its .shiftUp.
  describe("'skills' choiceType (e.g. Expertise)", () => {
    // Since 2026-10-07 the up 2 is the Perk's own DerivedStat rule (gated on perkValueRule), not a
    // shiftUp written into the actor - so it can't be counted twice, and goes with the Perk.
    test("writes no shiftUp onto the actor, and flags the copy for its rule", async () => {
      const actor = makeActor(1);
      const perk = makePerkItem({ value: 2 });

      await onPerkDrop(actor, perk, null, 'athletics', 'skills', null);

      expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.skills.athletics.shiftUp': expect.anything() }));
      expect(perk.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.choice': 'athletics', 'flags.essence20.perkValueRule': true }));
    });

    test("renames the granted Perk to include the chosen skill", async () => {
      const actor = makeActor(0);
      const perk = makePerkItem({ name: 'Expertise' });

      const newPerk = await onPerkDrop(actor, perk, null, 'athletics', 'skills', null);

      expect(newPerk.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Expertise (E20.SkillAthletics)', 'system.choice': 'athletics' }),
      );
    });
  });

  // Regression coverage for a live bug report: Commando's own Expertise still let the same skill
  // be picked twice. The choice-BUILDING dropdown already excludes an already-chosen skill, but
  // every Choices Selector dialog in this codebase is non-blocking - when 2 Expertise instances
  // are granted at the same level, both dialogs open (and build their own dropdowns) before
  // either is answered, so neither excludes the skill the other is about to pick. This re-checks
  // at actual confirm time instead, per the fix's own comment in onPerkDrop.
  describe("'skills' choiceType - Expertise's own duplicate-skill guard", () => {
    const EXPERTISE_GIJ_ID = "Compendium.essence20.gi_joe_crb.Item.F9kOLys1Iu4UOg22";

    function makeExpertisePerkItem() {
      return {
        name: 'Expertise',
        uuid: EXPERTISE_GIJ_ID,
        flags: { core: { sourceId: EXPERTISE_GIJ_ID } },
        system: {
          hasChoice: true, value: 2, isRoleVariant: false, selectionLimit: 4, rules: [{ type: 'UniqueChoice' }],
          advances: { canAdvance: false },
        },
        update: jest.fn(),
        delete: jest.fn(),
      };
    }

    // A sibling Expertise instance already sitting on the actor with its own choice already
    // made - the exact "another instance's dialog was confirmed first" scenario the fix targets.
    // Given its own _id (distinct from the perk being configured, which onPerkDrop's own
    // unrelated selectionLimit scan below also needs a real .get() lookup for).
    function makeExistingExpertiseInstance(choice) {
      return {
        _id: 'sibling1',
        type: 'perk',
        flags: { core: { sourceId: EXPERTISE_GIJ_ID } },
        system: { choice, advances: { canAdvance: false } },
      };
    }

    function makeActorWithItems(items) {
      const actor = makeActor(0);
      actor.system.skills.stealth = { shiftUp: 0 };
      items.get = (id) => items.find(item => item._id === id);
      actor.items = items;
      return actor;
    }

    test("rejects a skill already chosen by another Expertise instance on the actor", async () => {
      const actor = makeActorWithItems([makeExistingExpertiseInstance('athletics')]);
      const perk = makeExpertisePerkItem();

      await onPerkDrop(actor, perk, null, 'athletics', 'skills', null);

      expect(perk.update).not.toHaveBeenCalled();
      expect(actor.update).not.toHaveBeenCalled();
      expect(global.ui.notifications.warn).toHaveBeenCalled();
      // Regression coverage for a live bug report: an earlier fix deleted the rejected instance
      // outright, which stopped it dangling on the sheet as a dead, unnamed "Expertise" but traded
      // that bug for a worse one - the actor silently ends up without a Perk their own Role's
      // progression table says they're automatically owed at this level, with no way to get it
      // back short of manually re-dragging a replacement. It must be kept and re-configured
      // instead, so the actor still ends up with it.
      expect(perk.delete).not.toHaveBeenCalled();
    });

    test("still allows a genuinely different skill", async () => {
      const actor = makeActorWithItems([makeExistingExpertiseInstance('athletics')]);
      const perk = makeExpertisePerkItem();

      await onPerkDrop(actor, perk, null, 'stealth', 'skills', null);

      expect(perk.update).toHaveBeenCalledWith(
        expect.objectContaining({ 'system.choice': 'stealth' }),
      );
      expect(perk.delete).not.toHaveBeenCalled();
    });

    test("doesn't guard a non-Expertise 'skills'-choiceType Perk", async () => {
      const actor = makeActorWithItems([makeExistingExpertiseInstance('athletics')]);
      const perk = {
        name: 'Some Other Skills Perk',
        uuid: "Compendium.essence20.mlp_crb.Item.06cSi4Q1ztUPXWtw",
        flags: { core: { sourceId: "Compendium.essence20.mlp_crb.Item.06cSi4Q1ztUPXWtw" } },
        system: { hasChoice: true, value: 2, isRoleVariant: false, advances: { canAdvance: false } },
        update: jest.fn(),
      };

      await onPerkDrop(actor, perk, null, 'athletics', 'skills', null);

      expect(perk.update).toHaveBeenCalledWith(
        expect.objectContaining({ 'system.choice': 'athletics' }),
      );
    });
  });

  // Expertise now asks for both of its skills in a single MultiChoiceSelector (numChoices: 2) -
  // see onMultiSkillPerkDrop's own doc comment for why (this replaced 2 separate single-skill
  // grants at the same level, which used to race - see the duplicate-skill guard tests above).
  describe("onMultiSkillPerkDrop (e.g. Expertise choosing both skills at once)", () => {
    const EXPERTISE_GIJ_ID = "Compendium.essence20.gi_joe_crb.Item.F9kOLys1Iu4UOg22";

    // parentId/collectionId are what grantItemEntry stamps on a Role-granted instance. They
    // default to unset here so the tests that do not care about them are unaffected.
    function makeExpertisePerkItem({ parentId, collectionId } = {}) {
      return {
        name: 'Expertise',
        uuid: EXPERTISE_GIJ_ID,
        flags: { core: { sourceId: EXPERTISE_GIJ_ID } },
        system: {
          hasChoice: true, value: 2, isRoleVariant: false, selectionLimit: 4, numChoices: 2, rules: [{ type: 'UniqueChoice' }],
          advances: { canAdvance: false },
        },
        getFlag: (scope, key) => (key === 'parentId' ? parentId : key === 'collectionId' ? collectionId : undefined),
        update: jest.fn(),
        delete: jest.fn(),
      };
    }

    function makeExistingExpertiseInstance(choice) {
      return {
        _id: 'sibling1', type: 'perk',
        flags: { core: { sourceId: EXPERTISE_GIJ_ID } },
        system: { choice, advances: { canAdvance: false } },
      };
    }

    function makeActorWithItems(items) {
      const actor = makeActor(0);
      actor.system.skills.stealth = { shiftUp: 0 };
      actor.system.skills.streetwise = { shiftUp: 0 };
      items.get = (id) => items.find(item => item._id === id);
      actor.items = items;
      return actor;
    }

    beforeEach(() => {
      global.Item.create = jest.fn(async () => ({
        flags: { core: {} },
        system: { choice: null, advances: { canAdvance: false } },
        setFlag: jest.fn(),
        update: jest.fn(),
      }));
      global.fromUuid = jest.fn(async (uuid) => ({ uuid }));
    });

    afterEach(() => {
      global.Item.create = undefined;
      global.fromUuid = jest.fn();
    });

    test("configures the existing instance with the first skill and creates a second for the other", async () => {
      const actor = makeActorWithItems([]);
      const perk = makeExpertisePerkItem();

      await onMultiSkillPerkDrop(actor, perk, ['stealth', 'streetwise']);

      expect(perk.update).toHaveBeenCalledWith(
        expect.objectContaining({ 'system.choice': 'stealth' }),
      );
      expect(global.Item.create).toHaveBeenCalledTimes(1);
      const secondPerk = await global.Item.create.mock.results[0].value;
      expect(secondPerk.update).toHaveBeenCalledWith(
        expect.objectContaining({ 'system.choice': 'streetwise' }),
      );
    });

    test("rejects when both picks are the same skill, keeping the pending instance to re-configure", async () => {
      const actor = makeActorWithItems([]);
      const perk = makeExpertisePerkItem();

      await onMultiSkillPerkDrop(actor, perk, ['stealth', 'stealth']);

      expect(perk.update).not.toHaveBeenCalled();
      // Re-prompts on the same instance instead of deleting it - see the single-skill guard's own
      // test above for why (the actor must still end up with the Perk its own Role's progression
      // table says it's owed at this level, not silently lose it).
      expect(perk.delete).not.toHaveBeenCalled();
      expect(global.Item.create).not.toHaveBeenCalled();
    });

    // Live bug report: on a Commando, the 7th-level Expertise showed up as two Perks - one
    // badged "7" and one with no level at all, sorted to the bottom with the ungranted Perks,
    // which also survived dropping back to 6th. The twin created here was getting neither the
    // Role link nor the entry key, which is how the sheet resolves a level badge and how
    // deleteAttachmentsForItem finds what to take away again.
    test("the second Perk inherits the Role link and entry key from the instance it twins", async () => {
      const actor = makeActorWithItems([]);
      const perk = makeExpertisePerkItem({ parentId: 'role1', collectionId: '9bcf' });

      await onMultiSkillPerkDrop(actor, perk, ['stealth', 'streetwise']);

      const secondPerk = await global.Item.create.mock.results[0].value;
      expect(secondPerk.setFlag).toHaveBeenCalledWith('essence20', 'parentId', 'role1');
      expect(secondPerk.setFlag).toHaveBeenCalledWith('essence20', 'collectionId', '9bcf');
    });

    // A Perk granted by another PERK passes parentPerk explicitly; that still wins.
    test("an explicit parentPerk takes precedence over the twinned instance's own parentId", async () => {
      const actor = makeActorWithItems([]);
      const perk = makeExpertisePerkItem({ parentId: 'role1', collectionId: '9bcf' });
      // onPerkDrop walks a parentPerk's own items map to tag the copy it makes.
      const parentPerk = { _id: 'perk9', system: { items: {} } };

      await onMultiSkillPerkDrop(actor, perk, ['stealth', 'streetwise'], null, parentPerk);

      const secondPerk = await global.Item.create.mock.results[0].value;
      expect(secondPerk.setFlag).toHaveBeenCalledWith('essence20', 'parentId', 'perk9');
    });

    test("an ungranted instance twins cleanly - no parent to inherit, no flags invented", async () => {
      const actor = makeActorWithItems([]);
      const perk = makeExpertisePerkItem();

      await onMultiSkillPerkDrop(actor, perk, ['stealth', 'streetwise']);

      const secondPerk = await global.Item.create.mock.results[0].value;
      const flagged = secondPerk.setFlag.mock.calls.map(call => call.slice(0, 2).join('.'));
      expect(flagged).not.toContain('essence20.parentId');
      expect(flagged).not.toContain('essence20.collectionId');
    });

    // I've Done My Research (Beneath the Helmet, p.29) picks THREE skills - this function was
    // hardcoded to skills[0]/skills[1] until 2026-09-15, silently discarding any third pick.
    test("handles more than two skills, creating one extra instance per skill past the first", async () => {
      const actor = makeActorWithItems([]);
      actor.system.skills.science = { shiftUp: 0 };
      actor.system.skills.survival = { shiftUp: 0 };
      const perk = makeExpertisePerkItem();
      perk.system.numChoices = 3;

      await onMultiSkillPerkDrop(actor, perk, ['stealth', 'science', 'survival']);

      expect(perk.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.choice': 'stealth' }));
      expect(global.Item.create).toHaveBeenCalledTimes(2);

      const created = await Promise.all(global.Item.create.mock.results.map(r => r.value));
      const choices = created.map(
        c => c.update.mock.calls[0][0]['system.choice'],
      );
      expect(choices).toEqual(['science', 'survival']);
    });

    test("rejects a duplicate anywhere in a three-skill pick, not just the first two", async () => {
      const actor = makeActorWithItems([]);
      actor.system.skills.science = { shiftUp: 0 };
      const perk = makeExpertisePerkItem();
      perk.system.numChoices = 3;

      await onMultiSkillPerkDrop(actor, perk, ['stealth', 'science', 'science']);

      expect(perk.update).not.toHaveBeenCalled();
      expect(global.Item.create).not.toHaveBeenCalled();
    });

    test("rejects when one pick duplicates a skill already chosen by another Expertise instance", async () => {
      const actor = makeActorWithItems([makeExistingExpertiseInstance('athletics')]);
      const perk = makeExpertisePerkItem();

      await onMultiSkillPerkDrop(actor, perk, ['athletics', 'stealth']);

      expect(perk.update).not.toHaveBeenCalled();
      expect(perk.delete).not.toHaveBeenCalled();
      expect(global.ui.notifications.warn).toHaveBeenCalled();
    });
  });

  // Field (GI Joe CRB p.104, Technician/Expert Focus): "choose a Culture, Science, or Technology
  // Specialization... This is your Field." Unlike 'skills' above, this grants no numeric bonus of
  // its own (the Essence Increase that comes with it is handled generically elsewhere) - it only
  // needs to record which skill was chosen, the same "rename + system.choice, no numeric branch"
  // shape 'fightingStyle' already uses. Eureka/Expert in Your Field (dice.mjs) read this choice
  // back at roll time.
  describe("'field' choiceType (e.g. Field)", () => {
    function makeFieldPerkItem() {
      return {
        name: 'Field',
        uuid: "Compendium.essence20.gi_joe_crb.Item.qHLeKSMin2F19O3C",
        system: { hasChoice: true, isRoleVariant: false, advances: { canAdvance: false } },
        update: jest.fn(),
      };
    }

    test("records the chosen skill as system.choice and renames the Perk, with no numeric grant", async () => {
      const actor = makeActor(0);
      const perk = makeFieldPerkItem();

      const newPerk = await onPerkDrop(actor, perk, null, 'science', 'field', null);

      expect(newPerk.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Field (E20.SkillScience)', 'system.choice': 'science' }),
      );
      expect(actor.update).not.toHaveBeenCalled();
    });
  });

  // e.g. Master Specialization (Enigma of Combination, Bonded Master Focus, 1st level, p.33):
  // "You gain the Headmaster Body, Powermaster, or Targetmaster General Perk." Regression
  // coverage for this generic 'perks' choiceType grant path (perk.system.items -> fromUuid ->
  // Item.create), which had no test of its own despite being exercised by several other
  // compendium Perks already (e.g. Grid Science II's own multi-perk picker).
  describe("'perks' choiceType (e.g. Master Specialization)", () => {
    function makePerksPerkItem() {
      return {
        name: 'Master Specialization',
        uuid: "Compendium.essence20.enigma_of_combination.Item.fasskDJBsW8eY6tb",
        system: {
          hasChoice: true,
          isRoleVariant: false,
          advances: { canAdvance: false },
          items: {
            headmaster: { uuid: "Compendium.essence20.enigma_of_combination.Item.LY8HGN112nSRlhZ3" },
            powermaster: { uuid: "Compendium.essence20.enigma_of_combination.Item.RUlNdBVlWqFvkYLv" },
          },
        },
        update: jest.fn(),
      };
    }

    test("creates the chosen sub-Perk, flagged with its own collectionId/parentId", async () => {
      const actor = makeActor(0);
      const perk = makePerksPerkItem();
      const itemToCreate = { uuid: "Compendium.essence20.enigma_of_combination.Item.RUlNdBVlWqFvkYLv", system: { hasChoice: false } };
      global.fromUuid = jest.fn(async () => itemToCreate);
      const createdPerk = { setFlag: jest.fn(), update: jest.fn() };
      global.Item = { create: jest.fn(async () => createdPerk) };

      const newPerk = await onPerkDrop(actor, perk, null, 'powermaster', 'perks', null);

      expect(global.Item.create).toHaveBeenCalledWith(itemToCreate, { parent: actor });
      expect(createdPerk.setFlag).toHaveBeenCalledWith('essence20', 'collectionId', 'powermaster');
      expect(createdPerk.setFlag).toHaveBeenCalledWith('essence20', 'parentId', newPerk._id);
      expect(createdPerk.update).toHaveBeenCalledWith({ '_stats.compendiumSource': itemToCreate.uuid });
    });
  });

  // e.g. Fast (PR CRB p.95 / MLP CRB p.124): "Choose one movement type you already possess and
  // increase it by 10 feet." Regression coverage for MLP CRB's own copy of Fast, which used to
  // ship as 3 baked (1 enabled, 2 disabled) Active Effects the player had to manually retoggle
  // in the Effects tab instead of using this pre-existing generic choiceType:'movement' handling
  // (already exercised by PR CRB's identical Fast, but with no test of its own until now).
  describe("'movement' choiceType (e.g. Fast)", () => {
    function makeMovementActor(groundBonus = 0) {
      return {
        items: [],
        system: { movement: { ground: { bonus: groundBonus }, aerial: { bonus: 0 } } },
        update: jest.fn(),
      };
    }

    function makeMovementPerkItem({ value = 10 } = {}) {
      return {
        name: 'Fast',
        uuid: "Compendium.essence20.mlp_crb.Item.NU7KqcXvQbOFbU0C",
        system: { hasChoice: true, value, isRoleVariant: false, advances: { canAdvance: false } },
        update: jest.fn(),
      };
    }

    // Since 2026-10-07 the +10 ft is the Perk's own Movement rule (stage bonus, gated on perkValueRule).
    test("writes no movement bonus onto the actor, and flags the copy for its rule", async () => {
      const actor = makeMovementActor(20);
      const perk = makeMovementPerkItem({ value: 10 });

      await onPerkDrop(actor, perk, null, 'ground', 'movement', null);

      expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.movement.ground.bonus': expect.anything() }));
      expect(perk.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.choice': 'ground', 'flags.essence20.perkValueRule': true }));
    });

    describe("onPerkDelete", () => {
      function makeDropped({ flagged = false, choice = 'ground', value = 10 } = {}) {
        return {
          flags: flagged ? { essence20: { perkValueRule: true } } : {},
          _stats: {},
          system: { choiceType: 'movement', choice, value, hasChoice: true, isRoleVariant: false, advances: { canAdvance: false } },
        };
      }

      // A copy dropped before then had its value written into the actor - it still comes back off,
      // from the STORED bonus (the prepared one also holds the rules' bonuses).
      test("an unflagged (older) copy takes its value back off the stored bonus", async () => {
        const actor = { ...makeMovementActor(40), _source: { system: { movement: { ground: { bonus: 30 } } } }, items: [] };

        await onPerkDelete(actor, makeDropped());

        expect(actor.update).toHaveBeenCalledWith({ 'system.movement.ground.bonus': 20 });
      });

      test("a flagged copy writes nothing - its bonus was its own rule", async () => {
        const actor = { ...makeMovementActor(10), items: [] };

        await onPerkDelete(actor, makeDropped({ flagged: true }));

        expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.movement.ground.bonus': expect.anything() }));
      });

      test("a copy with no pick writes nothing", async () => {
        const actor = { ...makeMovementActor(10), items: [] };

        await onPerkDelete(actor, makeDropped({ choice: null }));

        expect(actor.update).not.toHaveBeenCalled();
      });
    });
  });

  // All-Terrain Alt Mode (TF CRB, General Perk, p.108): "Choose one of the following: Ground,
  // Aerial, or Aquatic. Your Alt Mode movement of the chosen type increases by 20 feet." The
  // compendium item ships all 3 bonuses as its own disabled Active Effects (one per movement
  // type) - this choiceType enables only the one matching the player's pick.
  describe("'altModeMovement' choiceType (e.g. All-Terrain Alt Mode)", () => {
    function makeAltModeEffect(movementType) {
      return {
        changes: [{ key: `system.movement.${movementType}.altMode`, mode: 5, value: '20' }],
        update: jest.fn(),
      };
    }

    function makeAltModePerk() {
      return {
        name: 'All-Terrain Alt Mode',
        uuid: 'Compendium.essence20.tf_crb.Item.f7QOaDUFo1b0184W',
        system: { hasChoice: true, isRoleVariant: false, advances: { canAdvance: false } },
        effects: [makeAltModeEffect('ground'), makeAltModeEffect('aerial'), makeAltModeEffect('swim')],
        update: jest.fn(),
      };
    }

    test("enables only the chosen movement type's bundled Active Effect", async () => {
      const actor = { items: [], system: {}, update: jest.fn() };
      const perk = makeAltModePerk();

      await onPerkDrop(actor, perk, null, 'aerial', 'altModeMovement', null);

      const [groundEffect, aerialEffect, swimEffect] = perk.effects;
      expect(aerialEffect.update).toHaveBeenCalledWith({ disabled: false });
      expect(groundEffect.update).not.toHaveBeenCalled();
      expect(swimEffect.update).not.toHaveBeenCalled();
    });

    test("names and records the choice on the granted Perk", async () => {
      const actor = { items: [], system: {}, update: jest.fn() };
      const perk = makeAltModePerk();

      await onPerkDrop(actor, perk, null, 'ground', 'altModeMovement', null);

      expect(perk.update).toHaveBeenCalledWith(expect.objectContaining({
        name: expect.stringContaining('Ground'),
        'system.choice': 'ground',
      }));
    });
  });
});

describe("getAlreadyChosenExpertiseSkills (GI Joe CRB, Commando base, 1st/7th level, p.72)", () => {
  const EXPERTISE_GIJ_ID = "Compendium.essence20.gi_joe_crb.Item.F9kOLys1Iu4UOg22";
  const OTHER_SKILLS_PERK_ID = "Compendium.essence20.mlp_crb.Item.06cSi4Q1ztUPXWtw";

  function makeExpertiseInstance(choice, { viaFlags = true } = {}) {
    return viaFlags
      ? { flags: { core: { sourceId: EXPERTISE_GIJ_ID } }, system: { choice } }
      : { flags: {}, _stats: { compendiumSource: EXPERTISE_GIJ_ID }, system: { choice } };
  }

  test("collects the skills already chosen by other Expertise instances on the actor", () => {
    const actor = {
      items: [makeExpertiseInstance('athletics'), makeExpertiseInstance('stealth')],
    };
    const perk = { flags: { core: { sourceId: EXPERTISE_GIJ_ID } }, system: { choice: null, rules: [{ type: 'UniqueChoice' }] } };

    expect(getAlreadyChosenExpertiseSkills(actor, perk)).toEqual(['athletics', 'stealth']);
  });

  test("falls back to _stats.compendiumSource for an Actor-embedded copy", () => {
    const actor = { items: [makeExpertiseInstance('athletics', { viaFlags: false })] };
    const perk = { flags: {}, _stats: { compendiumSource: EXPERTISE_GIJ_ID }, system: { choice: null, rules: [{ type: 'UniqueChoice' }] } };

    expect(getAlreadyChosenExpertiseSkills(actor, perk)).toEqual(['athletics']);
  });

  test("excludes the not-yet-chosen instance currently being configured", () => {
    const actor = { items: [makeExpertiseInstance('athletics'), makeExpertiseInstance(null)] };
    const perk = { flags: { core: { sourceId: EXPERTISE_GIJ_ID } }, system: { choice: null, rules: [{ type: 'UniqueChoice' }] } };

    expect(getAlreadyChosenExpertiseSkills(actor, perk)).toEqual(['athletics']);
  });

  test("ignores other 'skills'-choiceType Perks - this only narrows Expertise itself", () => {
    const actor = {
      items: [{ flags: { core: { sourceId: OTHER_SKILLS_PERK_ID } }, system: { choice: 'athletics' } }],
    };
    const perk = { flags: { core: { sourceId: EXPERTISE_GIJ_ID } }, system: { choice: null, rules: [{ type: 'UniqueChoice' }] } };

    expect(getAlreadyChosenExpertiseSkills(actor, perk)).toEqual([]);
  });

  test("returns an empty array when the Perk being configured isn't Expertise at all", () => {
    const actor = { items: [makeExpertiseInstance('athletics')] };
    const perk = { flags: { core: { sourceId: OTHER_SKILLS_PERK_ID } }, system: { choice: null } };

    expect(getAlreadyChosenExpertiseSkills(actor, perk)).toEqual([]);
  });
});

describe("Quantasaurus Rex (A Jump Through Time, Quantum Ranger Role Perk, 4th level, p.46)", () => {
  const QUANTASAURUS_REX_ID = "Compendium.essence20.jump_through_time.Item.sn5jhTf8sJqRFhKS";

  function makePerk() {
    return {
      uuid: QUANTASAURUS_REX_ID,
      flags: { core: { sourceId: QUANTASAURUS_REX_ID } },
      _stats: { compendiumSource: QUANTASAURUS_REX_ID },
      system: { hasChoice: false, isRoleVariant: false, advances: { canAdvance: false } },
    };
  }

  test("onPerkDelete revokes system.canHaveZord", async () => {
    const actor = { update: jest.fn(), system: { level: 4 }, items: [] };
    await onPerkDelete(actor, makePerk());
    expect(actor.update).toHaveBeenCalledWith({ "system.canHaveZord": false });
  });
});

describe("Phantom Ship (Across the Stars, Phantom Ranger Role Perk, 1st level, p.62)", () => {
  const PHANTOM_SHIP_ID = "Compendium.essence20.across_the_stars.Item.OfsTu9GpONWPV88t";

  function makePerk() {
    return {
      uuid: PHANTOM_SHIP_ID,
      flags: { core: { sourceId: PHANTOM_SHIP_ID } },
      _stats: { compendiumSource: PHANTOM_SHIP_ID },
      system: { hasChoice: false, isRoleVariant: false, advances: { canAdvance: false } },
    };
  }

  test("onPerkDelete revokes system.canHaveZord", async () => {
    const actor = { update: jest.fn(), system: { level: 1 }, items: [] };
    await onPerkDelete(actor, makePerk());
    expect(actor.update).toHaveBeenCalledWith({ "system.canHaveZord": false });
  });
});

describe("Nobody Like Me - any General Perk", () => {
  const NOBODY_LIKE_ME_ID = "Compendium.essence20.pr_crb.Item.9nvRKN0A8N0EEXUl";

  test("is recognised by its AnyGeneralPerkChoice rule, on the compendium item or a copy already on an actor", () => {
    const rules = [{ type: 'AnyGeneralPerkChoice' }];
    expect(grantsAnyGeneralPerk({ system: { rules } }, NOBODY_LIKE_ME_ID)).toBe(true);
    expect(grantsAnyGeneralPerk({ _stats: { compendiumSource: NOBODY_LIKE_ME_ID }, system: { rules } }, 'Actor.a.Item.b')).toBe(true);
    expect(grantsAnyGeneralPerk({ system: { rules: [{ type: 'AnyGeneralPerkChoice', disabled: true }] } }, NOBODY_LIKE_ME_ID)).toBe(false);
    expect(grantsAnyGeneralPerk({ system: {} }, 'Compendium.essence20.pr_crb.Item.other')).toBe(false);
  });

  describe("with compendium packs", () => {
    const originalPacks = game.packs;
    const makePack = (id, folder, entries, enabled = true) => ({
      documentName: 'Item',
      metadata: { id, label: id },
      folder: folder ? { name: folder } : null,
      enabled,
      getIndex: jest.fn(async () => entries),
    });

    beforeEach(() => {
      const packs = [
        makePack('essence20.pr_crb', 'Power Rangers', [
          { _id: 'p1', name: 'Iron Hands', type: 'perk', system: { type: 'general', source: { book: 'Power Rangers Core Rulebook' } } },
          { _id: 'p2', name: 'Morph Only', type: 'perk', system: { type: 'role' } },
          { _id: 'p3', name: 'Taken Already', type: 'perk', system: { type: 'general' } },
          { _id: 'x1', name: 'A Sword', type: 'weapon', system: {} },
        ]),
        makePack('essence20.gi_joe_crb', 'GI Joe', [
          { _id: 'g1', name: 'Iron Hands', type: 'perk', system: { type: 'general', source: { book: 'GI Joe Core Rulebook' } } },
        ]),
        makePack('essence20.hidden', 'My Little Pony', [
          { _id: 'h1', name: 'Hidden Perk', type: 'perk', system: { type: 'general' } },
        ]),
      ];
      packs.get = (id) => packs.find(pack => pack.metadata.id === id);
      global.game.packs = packs;
      // A GM has switched the My Little Pony book off (Configure Sourcebooks).
      global.game.settings.get.mockImplementation((scope, key) =>
        key === 'enabledSourcebooks' ? { 'essence20.hidden': false } : 'roll');
    });

    afterEach(() => {
      global.game.packs = originalPacks;
      global.game.settings.get.mockImplementation(() => 'roll');
    });

    test("offers every General Perk in every enabled book, and nothing already taken", async () => {
      const actor = { items: [{ _stats: { compendiumSource: 'Compendium.essence20.pr_crb.Item.p3' } }] };
      const choices = await anyGeneralPerkChoices(actor);
      expect(Object.keys(choices)).toEqual([
        'Compendium.essence20.pr_crb.Item.p1',
        'Compendium.essence20.gi_joe_crb.Item.g1',
      ]);
    });

    test("each choice carries its game line and book, since names repeat across books", async () => {
      const choices = await anyGeneralPerkChoices({ items: [] });
      expect(choices['Compendium.essence20.gi_joe_crb.Item.g1']).toMatchObject({
        label: 'Iron Hands', value: 'Compendium.essence20.gi_joe_crb.Item.g1',
        type: 'perks', group: 'GI Joe', detail: 'GI Joe Core Rulebook',
      });
    });

    test("gameLineOf reads the pack folder off a compendium uuid", () => {
      expect(gameLineOf(NOBODY_LIKE_ME_ID)).toBe('Power Rangers');
      expect(gameLineOf('Actor.a.Item.b')).toBeNull();
    });
  });
});
