import { jest } from '@jest/globals';
import {
  getAlreadyChosenExpertiseSkills, grantBeatdownWeapon, grantBlendIn, grantDutyOfTheSilverArmorTraining,
  grantEmtCrashCourse, grantForTheSyndicateMentor, grantJackhammerWeapon, onMultiSkillPerkDrop, onPerkDrop,
  setPerkAdvancesName,
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

describe("grantDutyOfTheSilverArmorTraining (Across the Stars, Silver Ranger, 7th level, p.57)", () => {
  function makeActor(trained = {}) {
    return {
      system: { trained: { armors: { heavy: false, ultraHeavy: false, ...trained } } },
      update: jest.fn(),
    };
  }

  test("grants Heavy Armor training when the actor doesn't already have it", async () => {
    const actor = makeActor({ heavy: false });

    await grantDutyOfTheSilverArmorTraining(actor);

    expect(actor.update).toHaveBeenCalledWith({ "system.trained.armors.heavy": true });
  });

  test("grants Ultra-Heavy Armor training instead when the actor already has Heavy", async () => {
    const actor = makeActor({ heavy: true });

    await grantDutyOfTheSilverArmorTraining(actor);

    expect(actor.update).toHaveBeenCalledWith({ "system.trained.armors.ultraHeavy": true });
  });
});

describe("grantBeatdownWeapon (Cobra Codex, Vanguard Warthog Focus, 3rd level, p.69)", () => {
  const CLOSE_COMBAT_HEAVY_BLUDGEONING_ID = "Compendium.essence20.gi_joe_crb.Item.xthnRWfhbfXvpmZN";

  function makeActor(items = []) {
    items.some = Array.prototype.some.bind(items);
    return { items };
  }

  beforeEach(() => {
    global.Item = { create: jest.fn(async () => ({})) };
    global.fromUuid = jest.fn(async (uuid) => ({ uuid }));
  });

  test("grants a copy of Close Combat Heavy Bludgeoning when the actor has none", async () => {
    const actor = makeActor([]);

    await grantBeatdownWeapon(actor);

    expect(global.fromUuid).toHaveBeenCalledWith(CLOSE_COMBAT_HEAVY_BLUDGEONING_ID);
    expect(global.Item.create).toHaveBeenCalledWith(
      { uuid: CLOSE_COMBAT_HEAVY_BLUDGEONING_ID }, { parent: actor },
    );
  });

  test("does nothing if the actor already has one (e.g. from Signature Weapon)", async () => {
    const actor = makeActor([
      { type: 'weapon', flags: { core: { sourceId: CLOSE_COMBAT_HEAVY_BLUDGEONING_ID } } },
    ]);

    await grantBeatdownWeapon(actor);

    expect(global.Item.create).not.toHaveBeenCalled();
  });
});

describe("grantJackhammerWeapon (Cobra Codex, Vanguard Warthog Focus, 20th level, p.69)", () => {
  const POWER_TOOL_ID = "Compendium.essence20.gi_joe_crb.Item.Jnjio1DtAx0QgE85";

  function makeActor(items = []) {
    items.some = Array.prototype.some.bind(items);
    return { items };
  }

  beforeEach(() => {
    global.Item = { create: jest.fn(async () => ({})) };
    global.fromUuid = jest.fn(async (uuid) => ({ uuid }));
  });

  test("grants a copy of Power Tool when the actor has none", async () => {
    const actor = makeActor([]);

    await grantJackhammerWeapon(actor);

    expect(global.fromUuid).toHaveBeenCalledWith(POWER_TOOL_ID);
    expect(global.Item.create).toHaveBeenCalledWith({ uuid: POWER_TOOL_ID }, { parent: actor });
  });

  test("does nothing if the actor already has one (e.g. from Signature Weapon)", async () => {
    const actor = makeActor([{ type: 'weapon', flags: { core: { sourceId: POWER_TOOL_ID } } }]);

    await grantJackhammerWeapon(actor);

    expect(global.Item.create).not.toHaveBeenCalled();
  });
});

describe("grantEmtCrashCourse (Ferocious Fighters, Combat Lifesaver, p.9)", () => {
  const EMT_CRASH_COURSE_ID = "Compendium.essence20.gi_joe_crb.Item.jDAu1zaZpv1IylJ8";

  function makeActor(items = []) {
    items.some = Array.prototype.some.bind(items);
    return { items };
  }

  beforeEach(() => {
    global.Item = { create: jest.fn(async () => ({})) };
    global.fromUuid = jest.fn(async (uuid) => ({ uuid }));
  });

  test("grants a copy of EMT Crash Course when the actor has none", async () => {
    const actor = makeActor([]);

    await grantEmtCrashCourse(actor);

    expect(global.fromUuid).toHaveBeenCalledWith(EMT_CRASH_COURSE_ID);
    expect(global.Item.create).toHaveBeenCalledWith({ uuid: EMT_CRASH_COURSE_ID }, { parent: actor });
  });

  test("does nothing if the actor already has EMT Crash Course", async () => {
    const actor = makeActor([
      { type: 'perk', flags: { core: { sourceId: EMT_CRASH_COURSE_ID } } },
    ]);

    await grantEmtCrashCourse(actor);

    expect(global.Item.create).not.toHaveBeenCalled();
  });

  test("does nothing if the actor already has it via _stats.compendiumSource", async () => {
    const actor = makeActor([
      { type: 'perk', _stats: { compendiumSource: EMT_CRASH_COURSE_ID } },
    ]);

    await grantEmtCrashCourse(actor);

    expect(global.Item.create).not.toHaveBeenCalled();
  });
});

describe("grantForTheSyndicateMentor (Factions in Action Vol. 2, International Syndicate Faction Perk, p.102)", () => {
  const MENTOR_ID = "Compendium.essence20.gi_joe_crb.Item.jUZrNJbPzSd1zVLa";

  function makeActor(items = []) {
    items.some = Array.prototype.some.bind(items);
    return { items };
  }

  beforeEach(() => {
    global.Item = { create: jest.fn(async () => ({})) };
    global.fromUuid = jest.fn(async (uuid) => ({ uuid }));
  });

  test("grants a copy of Mentor when the actor has none", async () => {
    const actor = makeActor([]);

    await grantForTheSyndicateMentor(actor);

    expect(global.fromUuid).toHaveBeenCalledWith(MENTOR_ID);
    expect(global.Item.create).toHaveBeenCalledWith({ uuid: MENTOR_ID }, { parent: actor });
  });

  test("does nothing if the actor already has Mentor", async () => {
    const actor = makeActor([
      { type: 'perk', flags: { core: { sourceId: MENTOR_ID } } },
    ]);

    await grantForTheSyndicateMentor(actor);

    expect(global.Item.create).not.toHaveBeenCalled();
  });
});

describe("grantBlendIn (Ferocious Fighters, Tiger Force General Perk / Change Its Stripes grant, p.37)", () => {
  const BLEND_IN_ID = "Compendium.essence20.ferocious_fighters.Item.mnze6jJ6eSYbS8Pr";
  const SILENT_UPGRADE_ID = "Compendium.essence20.gi_joe_crb.Item.nftZIaQ3MVn2nviU";
  const STEALTH_UPGRADE_ID = "Compendium.essence20.gi_joe_crb.Item.ThXrre0RHTcr1BEp";

  function makeArmorItem() {
    const armorItem = { type: 'armor', _id: 'armor1', system: { equipped: true, items: {} } };
    armorItem.update = jest.fn(async (data) => {
      for (const [path, value] of Object.entries(data)) {
        const match = path.match(/^system\.items\.(.+)$/);
        if (match && !(value instanceof foundry.data.operators.ForcedDeletion)) {
          armorItem.system.items[match[1]] = value;
        }
      }
    });
    return armorItem;
  }

  function makeActor(items = []) {
    items.some = Array.prototype.some.bind(items);
    items.find = Array.prototype.find.bind(items);
    return { items };
  }

  beforeEach(() => {
    global.Item = {
      create: jest.fn(async (doc) => ({ uuid: doc.uuid, type: doc.type, system: doc.system, setFlag: jest.fn() })),
    };
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid == BLEND_IN_ID) {
        return { uuid, type: 'perk' };
      }
      return { uuid, type: 'upgrade', system: { type: 'armor', description: '' } };
    });
  });

  test("grants the Blend In Perk and attaches Silent/Stealth to the actor's equipped armor", async () => {
    const armorItem = makeArmorItem();
    const actor = makeActor([armorItem]);

    await grantBlendIn(actor);

    expect(global.fromUuid).toHaveBeenCalledWith(BLEND_IN_ID);
    expect(global.Item.create).toHaveBeenCalledWith({ uuid: BLEND_IN_ID, type: 'perk' }, { parent: actor });
    const attachedUuids = Object.values(armorItem.system.items).map(entry => entry.uuid);
    expect(attachedUuids).toEqual(expect.arrayContaining([SILENT_UPGRADE_ID, STEALTH_UPGRADE_ID]));
  });
});

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
    test("adds the Perk's value as a shiftUp on the chosen skill, not a flat modifier", async () => {
      const actor = makeActor(0);
      const perk = makePerkItem({ value: 2 });

      await onPerkDrop(actor, perk, null, 'athletics', 'skills', null);

      expect(actor.update).toHaveBeenCalledWith({ 'system.skills.athletics.shiftUp': 2 });
    });

    test("adds onto an existing shiftUp rather than overwriting it", async () => {
      const actor = makeActor(1);
      const perk = makePerkItem({ value: 2 });

      await onPerkDrop(actor, perk, null, 'athletics', 'skills', null);

      expect(actor.update).toHaveBeenCalledWith({ 'system.skills.athletics.shiftUp': 3 });
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
          hasChoice: true, value: 2, isRoleVariant: false, selectionLimit: 4,
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

    function makeExpertisePerkItem() {
      return {
        name: 'Expertise',
        uuid: EXPERTISE_GIJ_ID,
        flags: { core: { sourceId: EXPERTISE_GIJ_ID } },
        system: {
          hasChoice: true, value: 2, isRoleVariant: false, selectionLimit: 4, numChoices: 2,
          advances: { canAdvance: false },
        },
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
    const perk = { flags: { core: { sourceId: EXPERTISE_GIJ_ID } }, system: { choice: null } };

    expect(getAlreadyChosenExpertiseSkills(actor, perk)).toEqual(['athletics', 'stealth']);
  });

  test("falls back to _stats.compendiumSource for an Actor-embedded copy", () => {
    const actor = { items: [makeExpertiseInstance('athletics', { viaFlags: false })] };
    const perk = { flags: {}, _stats: { compendiumSource: EXPERTISE_GIJ_ID }, system: { choice: null } };

    expect(getAlreadyChosenExpertiseSkills(actor, perk)).toEqual(['athletics']);
  });

  test("excludes the not-yet-chosen instance currently being configured", () => {
    const actor = { items: [makeExpertiseInstance('athletics'), makeExpertiseInstance(null)] };
    const perk = { flags: { core: { sourceId: EXPERTISE_GIJ_ID } }, system: { choice: null } };

    expect(getAlreadyChosenExpertiseSkills(actor, perk)).toEqual(['athletics']);
  });

  test("ignores other 'skills'-choiceType Perks - this only narrows Expertise itself", () => {
    const actor = {
      items: [{ flags: { core: { sourceId: OTHER_SKILLS_PERK_ID } }, system: { choice: 'athletics' } }],
    };
    const perk = { flags: { core: { sourceId: EXPERTISE_GIJ_ID } }, system: { choice: null } };

    expect(getAlreadyChosenExpertiseSkills(actor, perk)).toEqual([]);
  });

  test("returns an empty array when the Perk being configured isn't Expertise at all", () => {
    const actor = { items: [makeExpertiseInstance('athletics')] };
    const perk = { flags: { core: { sourceId: OTHER_SKILLS_PERK_ID } }, system: { choice: null } };

    expect(getAlreadyChosenExpertiseSkills(actor, perk)).toEqual([]);
  });
});
