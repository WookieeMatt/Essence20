import { jest } from '@jest/globals';
import {
  getAlreadyChosenExpertiseSkills, grantBattlizerAccess, grantBeatdownWeapon, grantBlendIn, grantPerkEquipmentMap,
  grantDutyOfTheSilverArmorTraining, grantEmtCrashCourse, grantForTheSyndicateMentor, grantIntoTheVoidDigDeep,
  grantJackhammerWeapon, grantMetamorphosis, grantColonyChangelingInfatuated, grantNanoflageMimic, grantNaturalScienceQualification,
  grantPetCompanionAnimalPet, grantShadowSaber, grantSynchronizationStayInFormation, grantYoungButExperiencedVeteran,
  onMultiSkillPerkDrop, onPerkDelete, onPerkDrop, setPerkAdvancesName, setPerkValues, setRoleVatiantPerks,
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

describe("grantShadowSaber (Across the Stars, Shadow Morph [Form] General Perk, p.70)", () => {
  const SHADOW_SABER_ID = "Compendium.essence20.across_the_stars.Item.PQ2msfDzjTGz8aXN";

  function makeActor(items = []) {
    items.some = Array.prototype.some.bind(items);
    return { items };
  }

  beforeEach(() => {
    global.Item = { create: jest.fn(async () => ({})) };
    global.fromUuid = jest.fn(async (uuid) => ({ uuid }));
  });

  test("grants a copy of the Shadow Saber when the actor has none", async () => {
    const actor = makeActor([]);

    await grantShadowSaber(actor);

    expect(global.fromUuid).toHaveBeenCalledWith(SHADOW_SABER_ID);
    expect(global.Item.create).toHaveBeenCalledWith({ uuid: SHADOW_SABER_ID }, { parent: actor });
  });

  test("does nothing if the actor already has one", async () => {
    const actor = makeActor([{ type: 'weapon', flags: { core: { sourceId: SHADOW_SABER_ID } } }]);

    await grantShadowSaber(actor);

    expect(global.Item.create).not.toHaveBeenCalled();
  });
});

describe("grantBattlizerAccess (Across the Stars, General Perk, p.68 / Beneath the Helmet, General Perk, p.52)", () => {
  const SPD_BATTLIZER_ID = "Compendium.essence20.across_the_stars.Item.qc82QDtZN3qVWqxV";

  function makeActor(items = []) {
    items.some = Array.prototype.some.bind(items);
    return { items };
  }

  beforeEach(() => {
    global.Item = { create: jest.fn(async () => ({})) };
    global.fromUuid = jest.fn(async (uuid) => ({ uuid }));
  });

  test("grants a copy of the chosen Battlizer when the actor has none", async () => {
    const actor = makeActor([]);

    await grantBattlizerAccess(actor, SPD_BATTLIZER_ID);

    expect(global.fromUuid).toHaveBeenCalledWith(SPD_BATTLIZER_ID);
    expect(global.Item.create).toHaveBeenCalledWith({ uuid: SPD_BATTLIZER_ID }, { parent: actor });
  });

  test("does nothing if the actor already has that Battlizer", async () => {
    const actor = makeActor([{ type: 'armor', flags: { core: { sourceId: SPD_BATTLIZER_ID } } }]);

    await grantBattlizerAccess(actor, SPD_BATTLIZER_ID);

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

describe("grantYoungButExperiencedVeteran (General Hawk's Personnel Files, Old Hand Advanced Role Perk)", () => {
  const VETERAN_ID = "Compendium.essence20.gi_joe_crb.Item.3ahVUG1yKCGNyscK";

  function makeActor(items = []) {
    items.some = Array.prototype.some.bind(items);
    return { items };
  }

  beforeEach(() => {
    global.Item = { create: jest.fn(async () => ({})) };
    global.fromUuid = jest.fn(async (uuid) => ({ uuid }));
  });

  test("grants a copy of Veteran when the actor has none", async () => {
    const actor = makeActor([]);

    await grantYoungButExperiencedVeteran(actor);

    expect(global.fromUuid).toHaveBeenCalledWith(VETERAN_ID);
    expect(global.Item.create).toHaveBeenCalledWith({ uuid: VETERAN_ID }, { parent: actor });
  });

  test("does nothing if the actor already has Veteran", async () => {
    const actor = makeActor([
      { type: 'perk', flags: { core: { sourceId: VETERAN_ID } } },
    ]);

    await grantYoungButExperiencedVeteran(actor);

    expect(global.Item.create).not.toHaveBeenCalled();
  });
});

describe("grantIntoTheVoidDigDeep (Factions in Action Vol 2, Arashikage Faction Perk)", () => {
  const DIG_DEEP_GIJ_ID = "Compendium.essence20.gi_joe_crb.Item.QJkcVXT7K4yNWFoT";

  function makeActor(items = []) {
    items.some = Array.prototype.some.bind(items);
    return { items };
  }

  beforeEach(() => {
    global.Item = { create: jest.fn(async () => ({})) };
    global.fromUuid = jest.fn(async (uuid) => ({ uuid }));
  });

  test("grants a copy of Dig Deep when the actor has none", async () => {
    const actor = makeActor([]);

    await grantIntoTheVoidDigDeep(actor);

    expect(global.fromUuid).toHaveBeenCalledWith(DIG_DEEP_GIJ_ID);
    expect(global.Item.create).toHaveBeenCalledWith({ uuid: DIG_DEEP_GIJ_ID }, { parent: actor });
  });

  test("does nothing if the actor already has Dig Deep", async () => {
    const actor = makeActor([
      { type: 'perk', flags: { core: { sourceId: DIG_DEEP_GIJ_ID } } },
    ]);

    await grantIntoTheVoidDigDeep(actor);

    expect(global.Item.create).not.toHaveBeenCalled();
  });
});

describe("grantSynchronizationStayInFormation (Quartermaster's Guide to Gear, Tech Officer Focus, p.22)", () => {
  const STAY_IN_FORMATION_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.pU3dKGNWYAhgRY6B";

  function makeActor(items = []) {
    items.some = Array.prototype.some.bind(items);
    return { items };
  }

  beforeEach(() => {
    global.Item = { create: jest.fn(async () => ({})) };
    global.fromUuid = jest.fn(async (uuid) => ({ uuid }));
  });

  test("grants a copy of Stay In Formation when the actor has none", async () => {
    const actor = makeActor([]);

    await grantSynchronizationStayInFormation(actor);

    expect(global.fromUuid).toHaveBeenCalledWith(STAY_IN_FORMATION_ID);
    expect(global.Item.create).toHaveBeenCalledWith({ uuid: STAY_IN_FORMATION_ID }, { parent: actor });
  });

  test("does nothing if the actor already has Stay In Formation", async () => {
    const actor = makeActor([
      { type: 'perk', flags: { core: { sourceId: STAY_IN_FORMATION_ID } } },
    ]);

    await grantSynchronizationStayInFormation(actor);

    expect(global.Item.create).not.toHaveBeenCalled();
  });
});

describe("grantPetCompanionAnimalPet (Cobra Codex, Wildlife Division Perk, p.78)", () => {
  const ANIMAL_PET_GIJ_ID = "Compendium.essence20.gi_joe_crb.Item.6oF71x58kaB302bH";

  function makeActor(items = []) {
    items.some = Array.prototype.some.bind(items);
    return { items };
  }

  beforeEach(() => {
    global.Item = { create: jest.fn(async () => ({})) };
    global.fromUuid = jest.fn(async (uuid) => ({ uuid }));
  });

  test("grants a copy of Animal Pet when the actor has none", async () => {
    const actor = makeActor([]);

    await grantPetCompanionAnimalPet(actor);

    expect(global.fromUuid).toHaveBeenCalledWith(ANIMAL_PET_GIJ_ID);
    expect(global.Item.create).toHaveBeenCalledWith({ uuid: ANIMAL_PET_GIJ_ID }, { parent: actor });
  });

  test("does nothing if the actor already has Animal Pet", async () => {
    const actor = makeActor([
      { type: 'perk', flags: { core: { sourceId: ANIMAL_PET_GIJ_ID } } },
    ]);

    await grantPetCompanionAnimalPet(actor);

    expect(global.Item.create).not.toHaveBeenCalled();
  });
});

describe("grantMetamorphosis (Dark Skies Over Equestria, General Perk, p.20)", () => {
  const COLONY_CHANGELING_ID = "Compendium.essence20.dark_skies_over_equestria.Item.FRUWPAePJzm7Mlf0";
  const METAMORPHOSED_CHANGELING_ID = "Compendium.essence20.dark_skies_over_equestria.Item.aD130X44xDxZ6o2U";

  function makeActor(items = []) {
    items.some = Array.prototype.some.bind(items);
    items.find = Array.prototype.find.bind(items);
    items.get = (id) => items.find(item => item._id === id);
    return { items, update: jest.fn() };
  }

  beforeEach(() => {
    // Metamorphosed Changeling really has its own hasChoice picker (2 of 6 benefits), but that
    // dialog-opening tail is the same "non-blocking ChoicesSelector/MultiChoiceSelector render()"
    // path this project's own tests never exercise end-to-end (see DUTY_OF_THE_SILVER_ID's own
    // comment above) - `advances.canAdvance: false` and no `hasChoice` is enough for setPerkValues
    // to fall through cleanly without crashing, so these tests can verify grantMetamorphosis's own
    // swap logic (delete Colony Changeling, create-once Metamorphosed Changeling) in isolation.
    global.Item = { create: jest.fn(async () => ({ system: { advances: { canAdvance: false } } })) };
    global.fromUuid = jest.fn(async (uuid) => ({ uuid }));
  });

  test("deletes Colony Changeling and grants Metamorphosed Changeling", async () => {
    const colonyChangeling = {
      type: 'perk',
      flags: { core: { sourceId: COLONY_CHANGELING_ID } },
      delete: jest.fn(),
    };
    const actor = makeActor([colonyChangeling]);

    await grantMetamorphosis(actor);

    expect(colonyChangeling.delete).toHaveBeenCalled();
    expect(global.fromUuid).toHaveBeenCalledWith(METAMORPHOSED_CHANGELING_ID);
    expect(global.Item.create).toHaveBeenCalledWith(
      { uuid: METAMORPHOSED_CHANGELING_ID }, { parent: actor },
    );
  });

  test("is a no-op deletion when the actor has no Colony Changeling", async () => {
    const actor = makeActor([]);

    await grantMetamorphosis(actor);

    expect(global.Item.create).toHaveBeenCalledWith(
      { uuid: METAMORPHOSED_CHANGELING_ID }, { parent: actor },
    );
  });

  test("does nothing if the actor is already Metamorphosed", async () => {
    const actor = makeActor([
      { type: 'perk', flags: { core: { sourceId: METAMORPHOSED_CHANGELING_ID } } },
    ]);

    await grantMetamorphosis(actor);

    expect(global.Item.create).not.toHaveBeenCalled();
  });
});

describe("grantColonyChangelingInfatuated (Dark Skies Over Equestria, Natural Shape choice, p.17)", () => {
  const INFATUATED_ID = "Compendium.essence20.dark_skies_over_equestria.Item.2Kw4msw0l4j6fTOm";

  function makeActor(items = []) {
    items.some = Array.prototype.some.bind(items);
    return { items };
  }

  beforeEach(() => {
    global.Item = { create: jest.fn() };
    global.fromUuid = jest.fn(async (uuid) => ({ uuid }));
  });

  test("grants Infatuated when the actor doesn't already have it", async () => {
    const actor = makeActor([]);

    await grantColonyChangelingInfatuated(actor);

    expect(global.fromUuid).toHaveBeenCalledWith(INFATUATED_ID);
    expect(global.Item.create).toHaveBeenCalledWith({ uuid: INFATUATED_ID }, { parent: actor });
  });

  test("does nothing if the actor already has Infatuated", async () => {
    const actor = makeActor([
      { type: 'influence', flags: { core: { sourceId: INFATUATED_ID } } },
    ]);

    await grantColonyChangelingInfatuated(actor);

    expect(global.Item.create).not.toHaveBeenCalled();
  });
});

describe("grantNaturalScienceQualification (Cobra Codex, Ranger Firestarter Focus, 1st level, p.58)", () => {
  test("writes Element Jet weapon qualification and training onto the actor", async () => {
    const actor = { update: jest.fn() };

    await grantNaturalScienceQualification(actor);

    expect(actor.update).toHaveBeenCalledWith({
      "system.qualified.weapons.element": true,
      "system.trained.weapons.element": true,
    });
  });
});

describe("setPerkValues - Combiner Specialization (Enigma of Combination, Component Ace Focus, 1st level, p.34)", () => {
  const COMBINER_SPECIALIZATION_ID = "Compendium.essence20.enigma_of_combination.Item.mWyO6mHSMG4TVw3J";
  const GESTALT_COMBINER_ID = "Compendium.essence20.enigma_of_combination.Item.a4BfJxhUC7hAhgdZ";
  const MATCHED_COMBINER_ID = "Compendium.essence20.enigma_of_combination.Item.ZIJnA0z3Mrp8pfbd";

  function makeActor(existingSourceId) {
    const items = existingSourceId
      ? [{ flags: { core: { sourceId: existingSourceId } }, _stats: {} }] : [];
    return {
      items,
      system: { health: { bonus: 0 } },
      update: jest.fn(),
    };
  }

  test("grants +1 Health instead of a picker when Gestalt Combiner is already held", async () => {
    const actor = makeActor(GESTALT_COMBINER_ID);
    const perk = { uuid: COMBINER_SPECIALIZATION_ID, system: { hasChoice: true, choiceType: 'perks' } };

    await setPerkValues(actor, perk);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 1 });
  });

  test("grants +1 Health instead of a picker when Matched Combiner is already held", async () => {
    const actor = makeActor(MATCHED_COMBINER_ID);
    const perk = { uuid: COMBINER_SPECIALIZATION_ID, system: { hasChoice: true, choiceType: 'perks' } };

    await setPerkValues(actor, perk);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 1 });
  });
});

describe("grantNanoflageMimic (Quartermaster's Guide to Gear, Chameleonite Focus, p.22)", () => {
  const MIMIC_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.WI0QTzlWkEusSQqY";

  function makeActor(items = []) {
    items.some = Array.prototype.some.bind(items);
    return { items };
  }

  beforeEach(() => {
    global.Item = { create: jest.fn(async () => ({ type: 'power', system: { items: {} } })) };
    global.fromUuid = jest.fn(async (uuid) => ({ uuid, type: 'power', system: { items: {} } }));
  });

  test("grants a copy of Mimic when the actor has none", async () => {
    const actor = makeActor([]);

    await grantNanoflageMimic(actor);

    expect(global.fromUuid).toHaveBeenCalledWith(MIMIC_ID);
    expect(global.Item.create).toHaveBeenCalledWith(
      { uuid: MIMIC_ID, type: 'power', system: { items: {} } }, { parent: actor },
    );
  });

  test("does nothing if the actor already has Mimic", async () => {
    const actor = makeActor([
      { type: 'power', flags: { core: { sourceId: MIMIC_ID } } },
    ]);

    await grantNanoflageMimic(actor);

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

    // parentId/collectionId are what grantItemEntry stamps on a Role-granted instance. They
    // default to unset here so the tests that do not care about them are unaffected.
    function makeExpertisePerkItem({ parentId, collectionId } = {}) {
      return {
        name: 'Expertise',
        uuid: EXPERTISE_GIJ_ID,
        flags: { core: { sourceId: EXPERTISE_GIJ_ID } },
        system: {
          hasChoice: true, value: 2, isRoleVariant: false, selectionLimit: 4, numChoices: 2,
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

    test("adds the Perk's value onto the chosen movement type's bonus", async () => {
      const actor = makeMovementActor(0);
      const perk = makeMovementPerkItem({ value: 10 });

      await onPerkDrop(actor, perk, null, 'ground', 'movement', null);

      expect(actor.update).toHaveBeenCalledWith({ 'system.movement.ground.bonus': 10 });
    });

    test("adds onto an existing movement bonus rather than overwriting it", async () => {
      const actor = makeMovementActor(20);
      const perk = makeMovementPerkItem({ value: 10 });

      await onPerkDrop(actor, perk, null, 'ground', 'movement', null);

      expect(actor.update).toHaveBeenCalledWith({ 'system.movement.ground.bonus': 30 });
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

describe("Grid Tap (Beneath the Helmet, Grid Power, p.57)", () => {
  const GRID_TAP_ID = "Compendium.essence20.beneath_the_helmet.Item.JKwabam49PLMVN28";
  const GRID_TECH_I_ID = "Compendium.essence20.pr_crb.Item.R7HF3aSR3ZPURh1W";

  function makeGridTechPerk(numChoices = 2) {
    return {
      uuid: GRID_TECH_I_ID,
      flags: { core: { sourceId: GRID_TECH_I_ID } },
      _stats: { compendiumSource: GRID_TECH_I_ID },
      system: { hasChoice: false, isRoleVariant: false, advances: { canAdvance: false }, numChoices },
      clone: jest.fn(function (changes) {
        return { ...this, system: { ...this.system, numChoices: changes['system.numChoices'] } };
      }),
    };
  }

  function makeActor({ hasGridTap = true } = {}) {
    const items = hasGridTap
      ? [{ _id: 'gridTap1', type: 'power', flags: { core: { sourceId: GRID_TAP_ID } } }]
      : [];
    items.get = jest.fn((id) => items.find(i => i._id == id) ?? null);
    return { update: jest.fn(), items };
  }

  test("bumps numChoices by 1 on a Grid Tech/Grid Science picker when the actor holds Grid Tap", async () => {
    const perk = makeGridTechPerk(2);
    const actor = makeActor({ hasGridTap: true });

    await setPerkValues(actor, perk);

    expect(perk.clone).toHaveBeenCalledWith({ 'system.numChoices': 3 });
  });

  test("doesn't bump numChoices without Grid Tap", async () => {
    const perk = makeGridTechPerk(2);
    const actor = makeActor({ hasGridTap: false });

    await setPerkValues(actor, perk);

    expect(perk.clone).not.toHaveBeenCalled();
  });

  test("doesn't bump numChoices on an unrelated Perk, even with Grid Tap", async () => {
    const OTHER_ID = "Compendium.essence20.pr_crb.Item.someOtherPerk12345";
    const perk = {
      uuid: OTHER_ID,
      flags: { core: { sourceId: OTHER_ID } },
      _stats: { compendiumSource: OTHER_ID },
      system: { hasChoice: false, isRoleVariant: false, advances: { canAdvance: false }, numChoices: 1 },
      clone: jest.fn(),
    };
    const actor = makeActor({ hasGridTap: true });

    await setPerkValues(actor, perk);

    expect(perk.clone).not.toHaveBeenCalled();
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

  test("setPerkValues grants system.canHaveZord, same as the PR CRB Zord Perk", async () => {
    const actor = { update: jest.fn(), items: [], system: { level: 4 } };
    await setPerkValues(actor, makePerk());
    expect(actor.update).toHaveBeenCalledWith({ "system.canHaveZord": true });
  });

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

  test("setPerkValues grants system.canHaveZord, same as the PR CRB Zord Perk", async () => {
    const actor = { update: jest.fn(), items: [], system: { level: 1 } };
    await setPerkValues(actor, makePerk());
    expect(actor.update).toHaveBeenCalledWith({ "system.canHaveZord": true });
  });

  test("onPerkDelete revokes system.canHaveZord", async () => {
    const actor = { update: jest.fn(), system: { level: 1 }, items: [] };
    await onPerkDelete(actor, makePerk());
    expect(actor.update).toHaveBeenCalledWith({ "system.canHaveZord": false });
  });
});

describe("Heavy/Medium/Ultra-Heavy Armor Shell (PR CRB, General Perks, p.95/97/98)", () => {
  const HEAVY_ARMOR_SHELL_ID = "Compendium.essence20.pr_crb.Item.XVrOmc94bK9G9F5P";
  const MEDIUM_ARMOR_SHELL_ID = "Compendium.essence20.pr_crb.Item.d4AKhKlDbkQqGwOu";
  const ULTRA_HEAVY_ARMOR_SHELL_ID = "Compendium.essence20.pr_crb.Item.xBeEe7X1MBoo4cYW";

  function makeShellPerk(sourceId) {
    return {
      uuid: sourceId,
      flags: { core: { sourceId } },
      _stats: { compendiumSource: sourceId },
      system: { hasChoice: false, isRoleVariant: false, hasMorphedToughnessBonus: false, advances: { canAdvance: false } },
    };
  }

  function makeActor(trained) {
    return { update: jest.fn(), items: [], system: { level: 4, trained: { armors: trained } } };
  }

  test("setPerkValues recomputes the morphed Toughness bonus from the actor's Armor Training when Heavy Armor Shell is granted", async () => {
    const actor = makeActor({ medium: true, heavy: true });
    await setPerkValues(actor, makeShellPerk(HEAVY_ARMOR_SHELL_ID));
    expect(actor.update).toHaveBeenCalledWith({
      "system.canSetToughnessBonus": true,
      "system.defenses.toughness.morphed": 4,
    });
  });

  test("setPerkValues recomputes for Ultra-Heavy Armor Shell", async () => {
    const actor = makeActor({ medium: true, heavy: true, ultraHeavy: true });
    await setPerkValues(actor, makeShellPerk(ULTRA_HEAVY_ARMOR_SHELL_ID));
    expect(actor.update).toHaveBeenCalledWith({
      "system.canSetToughnessBonus": true,
      "system.defenses.toughness.morphed": 6,
    });
  });

  test("onPerkDelete re-derives the bonus from what Armor Training remains, instead of resetting to 0", async () => {
    // Heavy Armor Shell just deleted - only the Role's own base Medium Training remains.
    const actor = makeActor({ medium: true });
    await onPerkDelete(actor, makeShellPerk(HEAVY_ARMOR_SHELL_ID));
    expect(actor.update).toHaveBeenCalledWith({
      "system.canSetToughnessBonus": true,
      "system.defenses.toughness.morphed": 2,
    });
  });

  test("onPerkDelete for Medium Armor Shell", async () => {
    const actor = makeActor({ light: true });
    await onPerkDelete(actor, makeShellPerk(MEDIUM_ARMOR_SHELL_ID));
    expect(actor.update).toHaveBeenCalledWith({
      "system.canSetToughnessBonus": true,
      "system.defenses.toughness.morphed": 1,
    });
  });
});

describe("Sorcery / Cost of Sorcery (Finster's Monster-Matic Cookbook, p.271)", () => {
  const SORCERY_PERK_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.xUBOE1s5pgVyUrwj";
  const COST_OF_SORCERY_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.BRpf0FNey5oDEvq3";

  function makePerk() {
    return {
      uuid: SORCERY_PERK_ID,
      flags: { core: { sourceId: SORCERY_PERK_ID } },
      _stats: { compendiumSource: SORCERY_PERK_ID },
      system: { hasChoice: false, isRoleVariant: false, advances: { canAdvance: false }, items: {} },
    };
  }

  test("setPerkValues sets sorcerous.levelTaken and auto-grants Cost of Sorcery", async () => {
    const actor = { update: jest.fn(), items: [], system: { level: 6 } };
    global.Item = { create: jest.fn(async () => ({})) };
    global.fromUuid = jest.fn(async (uuid) => ({ uuid }));

    await setPerkValues(actor, makePerk());

    expect(actor.update).toHaveBeenCalledWith({ "system.powers.sorcerous.levelTaken": 6 });
    expect(global.fromUuid).toHaveBeenCalledWith(COST_OF_SORCERY_ID);
    expect(global.Item.create).toHaveBeenCalledWith({ uuid: COST_OF_SORCERY_ID }, { parent: actor });
  });

  test("setPerkValues doesn't grant a second Cost of Sorcery if the actor already has one", async () => {
    const items = [{ _id: 'cos1', flags: { core: { sourceId: COST_OF_SORCERY_ID } }, getFlag: jest.fn(() => null) }];
    items.get = jest.fn((id) => items.find(i => i._id == id) ?? null);
    const actor = { update: jest.fn(), items, system: { level: 6 } };
    global.Item = { create: jest.fn(async () => ({})) };
    global.fromUuid = jest.fn(async (uuid) => ({ uuid }));

    await setPerkValues(actor, makePerk());

    expect(global.Item.create).not.toHaveBeenCalled();
  });

  test("onPerkDelete resets sorcerous.levelTaken and removes the granted Cost of Sorcery", async () => {
    const costOfSorcery = {
      _id: 'cos1', flags: { core: { sourceId: COST_OF_SORCERY_ID } }, delete: jest.fn(), getFlag: jest.fn(() => null),
    };
    const items = [costOfSorcery];
    items.get = jest.fn((id) => items.find(i => i._id == id) ?? null);
    const actor = { update: jest.fn(), items, system: { level: 6 } };

    await onPerkDelete(actor, makePerk());

    expect(actor.update).toHaveBeenCalledWith({ "system.powers.sorcerous.levelTaken": 0 });
    expect(costOfSorcery.delete).toHaveBeenCalled();
  });

  test("onPerkDelete doesn't error when Cost of Sorcery was already removed separately", async () => {
    const items = [];
    items.get = jest.fn(() => null);
    const actor = { update: jest.fn(), items, system: { level: 6 } };
    await expect(onPerkDelete(actor, makePerk())).resolves.not.toThrow();
  });
});
