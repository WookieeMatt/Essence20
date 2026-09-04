import { Essence20Actor } from "./actor.mjs";
import { jest } from '@jest/globals';

/**
 * Builds a bare Essence20Actor instance with the given type/system/items,
 * bypassing the real Foundry Actor construction pipeline.
 */
function makeActor(type, system, documentsByType = {}) {
  const actor = new Essence20Actor();
  actor.type = type;
  actor.system = system;

  const byType = {
    armor: [],
    origin: [],
    rolePoints: [],
    ...documentsByType,
  };
  // Real Foundry EmbeddedCollections are both iterable over every item (used by
  // _prepareVision's `for...of`) AND grouped by type via .documentsByType, with a
  // Map-like .get(id) (used by _getBaseRolePoints to look up an owning Role) - an array
  // covers the first two for free, with .get() attached as an extra property.
  const allItems = Object.values(byType).flat();
  allItems.documentsByType = byType;
  allItems.get = (id) => allItems.find(item => item._id === id);
  actor.items = allItems;

  return actor;
}

function rolePointsItem(overrides = {}) {
  return {
    name: "Test Role Points",
    system: {
      bonus: {
        type: 'none',
        startingValue: 0,
        increase: 0,
        increaseLevels: [],
        level20Value: 0,
        defenseBonus: {},
      },
      resource: {
        level20ValueIsUnlimited: false,
      },
      isActivatable: false,
      isActive: false,
      ...overrides,
    },
    // _getBaseRolePoints looks up this RolePoints item's owning Role via its "parentId" flag,
    // to check whether that Role is an "additive" one (e.g. Old Hand) whose RolePoints run on
    // a separate level track. None of the fixtures here set a parentId, so this always
    // resolves to "no owning Role found" -> treated as the base Role's own RolePoints, same as
    // this mock behaved before that lookup existed.
    getFlag: () => undefined,
  };
}

describe("_prepareHealth", () => {
  test("defaults to 0 health when there's no origin or role points bonus", () => {
    const actor = makeActor('playerCharacter', {
      level: 1,
      conditioning: 2,
      health: { bonus: 1 },
    });
    actor._prepareHealth();
    expect(actor.system.health.max).toBe(3); // 0 (origin) + 0 (role points) + 2 (conditioning) + 1 (bonus)
  });

  test("adds starting health from the actor's Origin", () => {
    const actor = makeActor('playerCharacter', {
      level: 1,
      conditioning: 0,
      health: { bonus: 0 },
    }, {
      origin: [{ name: "Human", system: { startingHealth: 10 } }],
    });
    actor._prepareHealth();
    expect(actor.system.health.max).toBe(10);
    expect(actor.system.health.string).toContain("10 (Human)");
  });

  test("adds Role Points health bonus using level20Value at level 20", () => {
    const actor = makeActor('playerCharacter', {
      level: 20,
      conditioning: 0,
      health: { bonus: 0 },
    }, {
      rolePoints: [rolePointsItem({
        bonus: { type: 'healthBonus', startingValue: 2, increaseLevels: ["5"], level20Value: 50 },
      })],
    });
    actor._prepareHealth();
    expect(actor.system.health.max).toBe(50);
  });

  test("adds Role Points health bonus using startingValue + level increases below level 20", () => {
    const actor = makeActor('playerCharacter', {
      level: 10,
      conditioning: 0,
      health: { bonus: 0 },
    }, {
      rolePoints: [rolePointsItem({
        bonus: { type: 'healthBonus', startingValue: 2, increaseLevels: ["5"], level20Value: 50 },
      })],
    });
    actor._prepareHealth();
    // startingValue (2) + 1 increase reached (level 5 <= 10)
    expect(actor.system.health.max).toBe(3);
  });

  test("ignores Role Points bonus of the wrong type", () => {
    const actor = makeActor('playerCharacter', {
      level: 10,
      conditioning: 0,
      health: { bonus: 0 },
    }, {
      rolePoints: [rolePointsItem({
        bonus: { type: 'defenseBonus', startingValue: 99, increaseLevels: [], level20Value: 99 },
      })],
    });
    actor._prepareHealth();
    expect(actor.system.health.max).toBe(0);
  });

  test("ignores an activatable Role Points bonus that isn't active", () => {
    const actor = makeActor('playerCharacter', {
      level: 10,
      conditioning: 0,
      health: { bonus: 0 },
    }, {
      rolePoints: [rolePointsItem({
        bonus: { type: 'healthBonus', startingValue: 99, increaseLevels: [], level20Value: 99 },
        isActivatable: true,
        isActive: false,
      })],
    });
    actor._prepareHealth();
    expect(actor.system.health.max).toBe(0);
  });
});

describe("_prepareDefenses", () => {
  function defensesSystem(overrides = {}) {
    return {
      level: 10,
      isMorphed: false,
      essences: {
        strength: { max: 2 },
        speed: { max: 1 },
        smarts: { max: 3 },
        social: { max: 0 },
      },
      defenses: {
        cleverness: { base: 10, armor: 1, bonus: 0, morphed: 4, shield: 0, essence: 'smarts' },
        evasion: { base: 10, armor: 2, bonus: 1, morphed: 5, shield: 0, essence: 'speed' },
        toughness: { base: 10, armor: 0, bonus: 0, morphed: 6, shield: 3, essence: 'strength' },
        willpower: { base: 10, armor: 0, bonus: 0, morphed: 7, shield: 0, essence: 'social' },
      },
      ...overrides,
    };
  }

  test("totals base + essence + armor + bonus + shield when not morphed", () => {
    const actor = makeActor('playerCharacter', defensesSystem());
    actor._prepareDefenses();
    // toughness: base 10 + essence(strength.max) 2 + armor 0 + shield 3 + bonus 0 + roleBonus 0
    expect(actor.system.defenses.toughness.total).toBe(15);
    // evasion: base 10 + essence(speed.max) 1 + armor 2 + shield 0 + bonus 1 + roleBonus 0
    expect(actor.system.defenses.evasion.total).toBe(14);
  });

  test("uses morphed value instead of armor when isMorphed is true", () => {
    const actor = makeActor('playerCharacter', defensesSystem({ isMorphed: true }));
    actor._prepareDefenses();
    // toughness: base 10 + essence 2 + morphed 6 + shield 3 + bonus 0 + roleBonus 0
    expect(actor.system.defenses.toughness.total).toBe(21);
  });

  test("adds an active Role Points defense bonus for the matching defense type", () => {
    const actor = makeActor('playerCharacter', defensesSystem(), {
      rolePoints: [rolePointsItem({
        type: 'defenseBonus',
        bonus: {
          type: 'defenseBonus',
          startingValue: 2,
          increaseLevels: [],
          level20Value: 0,
          defenseBonus: { toughness: true },
        },
      })],
    });
    actor._prepareDefenses();
    expect(actor.system.defenses.toughness.total).toBe(17); // 15 + 2
    expect(actor.system.defenses.evasion.total).toBe(14); // unaffected, not the bonus's defense type
  });

  describe("Vanguard armor-conditional Perk bonuses", () => {
    const ARMOR_EXPERT_ID = "Compendium.essence20.gi_joe_crb.Item.0a01vmWtbbYYcNvA";
    const THE_HEAVY_ID = "Compendium.essence20.gi_joe_crb.Item.rlD6YJSr2fgROKHo";
    // Iron Heart is deliberately absent from this file's own runtime code - see the top-of-file
    // comment on actor.mjs's ARMOR_EXPERT_ID/THE_HEAVY_ID block. Its compendium Item already
    // carries an enabled Active Effect for its full +1 Toughness/+1 Evasion/+1 Health, which
    // Jest's mocked actors never apply (they build system.defenses directly, bypassing Foundry's
    // real Active Effect pipeline) - so there is nothing for _prepareDefenses() itself to test
    // here without reintroducing the double-count this same cross-check caught and removed.

    function perk(sourceId) {
      return { type: 'perk', flags: { core: { sourceId } } };
    }

    function armorItem({ equipped = true, classification = 'light' } = {}) {
      return { type: 'armor', system: { equipped, classification } };
    }

    test("Armor Expert adds +2 Toughness only while any armor is equipped", () => {
      const actor = makeActor('playerCharacter', defensesSystem(), {
        armor: [armorItem()],
        perk: [perk(ARMOR_EXPERT_ID)],
      });
      actor._prepareDefenses();
      expect(actor.system.defenses.toughness.total).toBe(17); // 15 + 2
      expect(actor.system.defenses.evasion.total).toBe(14); // unaffected, Armor Expert is Toughness-only
    });

    test("Armor Expert does nothing without any armor equipped", () => {
      const actor = makeActor('playerCharacter', defensesSystem(), {
        armor: [armorItem({ equipped: false })],
        perk: [perk(ARMOR_EXPERT_ID)],
      });
      actor._prepareDefenses();
      expect(actor.system.defenses.toughness.total).toBe(15); // unaffected
    });

    test("The Heavy adds +2 Toughness only while heavy/super heavy armor is equipped", () => {
      const actor = makeActor('playerCharacter', defensesSystem(), {
        armor: [armorItem({ classification: 'heavy' })],
        perk: [perk(THE_HEAVY_ID)],
      });
      actor._prepareDefenses();
      expect(actor.system.defenses.toughness.total).toBe(17); // 15 + 2
    });

    test("The Heavy does nothing while only light/medium armor is equipped", () => {
      const actor = makeActor('playerCharacter', defensesSystem(), {
        armor: [armorItem({ classification: 'light' })],
        perk: [perk(THE_HEAVY_ID)],
      });
      actor._prepareDefenses();
      expect(actor.system.defenses.toughness.total).toBe(15); // unaffected
    });

    test("Armor Expert and The Heavy stack while wearing heavy armor", () => {
      const actor = makeActor('playerCharacter', defensesSystem(), {
        armor: [armorItem({ classification: 'ultraHeavy' })],
        perk: [perk(ARMOR_EXPERT_ID), perk(THE_HEAVY_ID)],
      });
      actor._prepareDefenses();
      expect(actor.system.defenses.toughness.total).toBe(19); // 15 + 2 + 2
    });

  });

  describe("Fighting Style (Infantry/Vanguard, shared Perk)", () => {
    const FIGHTING_STYLE_ID = "Compendium.essence20.gi_joe_crb.Item.2LtDCHxgg9bMvWQK";

    function fightingStylePerk(choice) {
      return { type: 'perk', flags: { core: { sourceId: FIGHTING_STYLE_ID } }, system: { choice } };
    }

    function armorItem({ equipped = true } = {}) {
      return { type: 'armor', system: { equipped, classification: 'light' } };
    }

    test("Careful adds +2 Toughness/Evasion while the actor has the Cover status", () => {
      const actor = makeActor('playerCharacter', defensesSystem(), {
        perk: [fightingStylePerk('careful')],
      });
      actor.statuses = new Set(['cover']);
      actor._prepareDefenses();
      expect(actor.system.defenses.toughness.total).toBe(17); // 15 + 2
      expect(actor.system.defenses.evasion.total).toBe(16); // 14 + 2
    });

    test("Careful does nothing without the Cover status", () => {
      const actor = makeActor('playerCharacter', defensesSystem(), {
        perk: [fightingStylePerk('careful')],
      });
      actor.statuses = new Set();
      actor._prepareDefenses();
      expect(actor.system.defenses.toughness.total).toBe(15); // unaffected
    });

    test("Defense adds +1 Toughness/Evasion while any armor is equipped", () => {
      const actor = makeActor('playerCharacter', defensesSystem(), {
        armor: [armorItem()],
        perk: [fightingStylePerk('defense')],
      });
      actor._prepareDefenses();
      expect(actor.system.defenses.toughness.total).toBe(16); // 15 + 1
      expect(actor.system.defenses.evasion.total).toBe(15); // 14 + 1
    });

    test("Defense does nothing without any armor equipped", () => {
      const actor = makeActor('playerCharacter', defensesSystem(), {
        armor: [armorItem({ equipped: false })],
        perk: [fightingStylePerk('defense')],
      });
      actor._prepareDefenses();
      expect(actor.system.defenses.toughness.total).toBe(15); // unaffected
    });

    test("an unautomated choice (e.g. Akimbo) has no defense effect", () => {
      const actor = makeActor('playerCharacter', defensesSystem(), {
        armor: [armorItem()],
        perk: [fightingStylePerk('akimbo')],
      });
      actor.statuses = new Set(['cover']);
      actor._prepareDefenses();
      expect(actor.system.defenses.toughness.total).toBe(15); // unaffected
    });

    test("no effect when the Perk hasn't been chosen at all", () => {
      const actor = makeActor('playerCharacter', defensesSystem());
      actor.statuses = new Set(['cover']);
      actor._prepareDefenses();
      expect(actor.system.defenses.toughness.total).toBe(15); // unaffected
    });
  });
});

describe("_prepareMovement", () => {
  function movementSystem(overrides = {}) {
    return {
      isMorphed: false,
      isTransformed: false,
      movement: {
        aerial: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        ground: { base: 30, bonus: 5, morphed: 10, altMode: 60 },
        climb: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        swim: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
      },
      ...overrides,
    };
  }

  test("normal movement uses base + bonus", () => {
    const actor = makeActor('playerCharacter', movementSystem());
    actor._prepareMovement();
    expect(actor.system.movement.ground.total).toBe(35);
  });

  test("morphed movement uses base + bonus + morphed", () => {
    const actor = makeActor('playerCharacter', movementSystem({ isMorphed: true }));
    actor._prepareMovement();
    expect(actor.system.movement.ground.total).toBe(45);
  });

  test("transformed movement uses altMode + bonus, ignoring morphed", () => {
    const actor = makeActor('playerCharacter', movementSystem({ isTransformed: true }));
    actor._prepareMovement();
    expect(actor.system.movement.ground.total).toBe(65);
  });

  test("morphed and transformed movement uses altMode + bonus + morphed", () => {
    const actor = makeActor('playerCharacter', movementSystem({ isMorphed: true, isTransformed: true }));
    actor._prepareMovement();
    expect(actor.system.movement.ground.total).toBe(75);
  });

  test("climb/swim fall back to half of ground total (rounded to nearest 5) when unset", () => {
    const actor = makeActor('playerCharacter', movementSystem());
    actor._prepareMovement();
    // ground.total = 35 -> floor(35 / 5 * .5) * 5 = floor(3.5) * 5 = 15
    expect(actor.system.movement.climb.total).toBe(15);
    expect(actor.system.movement.swim.total).toBe(15);
  });

  test("flags movementNotSet when every movement type totals 0", () => {
    const actor = makeActor('playerCharacter', movementSystem({
      movement: {
        aerial: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        ground: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        climb: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        swim: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
      },
    }));
    actor._prepareMovement();
    expect(actor.system.movementNotSet).toBe(true);
  });
});

describe("_prepareSorcerousPower", () => {
  test("computes max power from level and levelTaken", () => {
    const actor = makeActor('playerCharacter', {
      level: 10,
      powers: { sorcerous: { levelTaken: 4 } },
    });
    actor._prepareSorcerousPower();
    // (10 - 4) * 2 + 4 = 16
    expect(actor.system.powers.sorcerous.max).toBe(16);
  });

  test("max is 0 when the power hasn't been taken", () => {
    const actor = makeActor('playerCharacter', {
      level: 10,
      powers: { sorcerous: { levelTaken: 0 } },
    });
    actor._prepareSorcerousPower();
    expect(actor.system.powers.sorcerous.max).toBe(0);
  });
});

describe("_prepareResource", () => {
  test("enables unlimited resource at level 20 when Role Points grants it", () => {
    const actor = makeActor('playerCharacter', { level: 20 }, {
      rolePoints: [rolePointsItem({ resource: { level20ValueIsUnlimited: true } })],
    });
    actor._prepareResource();
    expect(actor.system.useUnlimitedResource).toBe(true);
  });

  test("does not enable unlimited resource below level 20", () => {
    const actor = makeActor('playerCharacter', { level: 19 }, {
      rolePoints: [rolePointsItem({ resource: { level20ValueIsUnlimited: true } })],
    });
    actor._prepareResource();
    expect(actor.system.useUnlimitedResource).toBe(false);
  });
});

describe("_preparePoisonTraining", () => {
  function poisonSystem(poisonTraining) {
    return {
      poisonTraining,
      trained: {
        poisons: { all: true, standard: true, limited: true },
        toxins: { all: true, standard: true, limited: true },
      },
      qualified: {
        poisons: { all: true, standard: true, limited: true },
      },
    };
  }

  test("resets everything to false at training level 0", () => {
    const actor = makeActor('playerCharacter', poisonSystem(0));
    actor._preparePoisonTraining();
    expect(actor.system.trained.poisons).toEqual({ all: false, standard: false, limited: false });
    expect(actor.system.trained.toxins).toEqual({ all: false, standard: false, limited: false });
    expect(actor.system.qualified.poisons).toEqual({ all: false, standard: false, limited: false });
  });

  test("level 1 trains poisons but not toxins or qualified poisons", () => {
    const actor = makeActor('playerCharacter', poisonSystem(1));
    actor._preparePoisonTraining();
    expect(actor.system.trained.poisons).toEqual({ all: true, standard: true, limited: true });
    expect(actor.system.trained.toxins).toEqual({ all: false, standard: false, limited: false });
    expect(actor.system.qualified.poisons).toEqual({ all: false, standard: false, limited: false });
  });

  test("level 5 trains and qualifies everything", () => {
    const actor = makeActor('playerCharacter', poisonSystem(5));
    actor._preparePoisonTraining();
    expect(actor.system.trained.poisons).toEqual({ all: true, standard: true, limited: true });
    expect(actor.system.trained.toxins).toEqual({ all: true, standard: true, limited: true });
    expect(actor.system.qualified.poisons).toEqual({ all: true, standard: true, limited: true });
  });
});

describe("prepareDerivedData", () => {
  test("computes player-character-specific derived data for a playerCharacter", () => {
    const actor = makeActor('playerCharacter', {
      level: 1,
      conditioning: 0,
      health: { bonus: 0 },
      isMorphed: false,
      isTransformed: false,
      essences: {
        strength: { max: 0 }, speed: { max: 0 }, smarts: { max: 0 }, social: { max: 0 },
      },
      defenses: {
        cleverness: { base: 10, armor: 0, bonus: 0, morphed: 0, shield: 0, essence: 'smarts' },
        evasion: { base: 10, armor: 0, bonus: 0, morphed: 0, shield: 0, essence: 'speed' },
        toughness: { base: 10, armor: 0, bonus: 0, morphed: 0, shield: 0, essence: 'strength' },
        willpower: { base: 10, armor: 0, bonus: 0, morphed: 0, shield: 0, essence: 'social' },
      },
      movement: {
        aerial: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        ground: { base: 30, bonus: 0, morphed: 0, altMode: 0 },
        climb: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        swim: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
      },
      powers: { sorcerous: { levelTaken: 0 } },
      poisonTraining: 0,
      trained: { poisons: {}, toxins: {} },
      qualified: { poisons: {} },
    });

    actor.prepareDerivedData();

    expect(actor.system.health.max).toBe(0);
    expect(actor.system.defenses.toughness.total).toBe(10);
    expect(actor.system.movement.ground.total).toBe(30);
    expect(actor.system.powers.sorcerous.max).toBe(0);
  });

  test("leaves player-character-only fields untouched for an npc", () => {
    const actor = makeActor('npc', { health: { bonus: 0 } });
    actor.prepareDerivedData();
    expect(actor.system.health.max).toBeUndefined();
  });
});

describe("getRollData", () => {
  test("builds the initiative formula from the initiative skill's shift and modifier", () => {
    const actor = makeActor('playerCharacter', {
      initiative: { skill: 'speed' },
      skills: { speed: { shift: 'd8', modifier: 2 } },
    });
    const data = actor.getRollData();
    expect(data.initiativeFormula).toBe("d20 + d8 + 2");
  });

  test("uses a bare d20 when the initiative skill's shift is already d20", () => {
    const actor = makeActor('playerCharacter', {
      initiative: { skill: 'speed' },
      skills: { speed: { shift: 'd20', modifier: 0 } },
    });
    const data = actor.getRollData();
    expect(data.initiativeFormula).toBe("d20 + 0");
  });
});

describe("rollSkill", () => {
  test("delegates to the Dice helper", () => {
    const actor = makeActor('playerCharacter', {});
    actor._dice.rollSkill = jest.fn();
    const dataset = { skill: 'speed' };
    actor.rollSkill(dataset);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(dataset, actor);
  });
});
