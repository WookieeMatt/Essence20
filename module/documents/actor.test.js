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
    role: [],
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

  describe("H.I.S.S. Column (GI Joe CRB, Vehicle Trait, p.302)", () => {
    const vehicleToken = { document: { disposition: 1 }, center: { x: 0, y: 0 } };

    function otherHiss(distinguisher) {
      return {
        actor: { name: 'H.I.S.S.', system: { traits: { hissColumn: true } } },
        document: { disposition: 1 },
        center: { x: distinguisher, y: 0 },
      };
    }

    beforeEach(() => {
      global.canvas = {
        tokens: { placeables: [vehicleToken] },
        grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
      };
    });

    function makeHissVehicle({ hissColumn = true } = {}) {
      const actor = makeActor('vehicle', defensesSystem({ traits: { hissColumn } }));
      actor.name = 'H.I.S.S.';
      actor.getActiveTokens = jest.fn(() => [vehicleToken]);
      return actor;
    }

    test("no bonus with no other H.I.S.S. on the scene", () => {
      const actor = makeHissVehicle();
      actor._prepareDefenses();
      expect(actor.system.defenses.evasion.total).toBe(14); // unaffected
    });

    test("adds +1 Evasion per other same-named H.I.S.S.-Column-flagged token on the scene", () => {
      const actor = makeHissVehicle();
      canvas.tokens.placeables = [vehicleToken, otherHiss(1), otherHiss(2)];
      actor._prepareDefenses();
      expect(actor.system.defenses.evasion.total).toBe(16); // 14 + 2
    });

    test("doesn't count a differently-named vehicle, even with the trait", () => {
      const actor = makeHissVehicle();
      const other = otherHiss(1);
      other.actor.name = 'F.A.N.G.';
      canvas.tokens.placeables = [vehicleToken, other];
      actor._prepareDefenses();
      expect(actor.system.defenses.evasion.total).toBe(14); // unaffected
    });

    test("does nothing without the hissColumn trait itself", () => {
      const actor = makeHissVehicle({ hissColumn: false });
      canvas.tokens.placeables = [vehicleToken, otherHiss(1)];
      actor._prepareDefenses();
      expect(actor.system.defenses.evasion.total).toBe(14); // unaffected
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
        burrow: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        climb: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        swim: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
      },
      ...overrides,
    };
  }

  // Burrow Movement (Burrower, tsitems) - added as a full movement type rather than left as a
  // dangling Active Effect key. Unlike climb/swim it has NO half-Ground default: an actor only
  // has Burrow Movement because something explicitly granted it.
  test("burrow stays at zero when nothing grants it", () => {
    const actor = makeActor('playerCharacter', movementSystem());
    actor._prepareMovement();
    expect(actor.system.movement.burrow.total).toBe(0);
  });

  test("burrow granted by an effect overriding its base is totalled like any other type", () => {
    const system = movementSystem();
    // Exactly what Burrower's own Active Effect does: override system.movement.burrow.base.
    system.movement.burrow.base = 25;
    const actor = makeActor('playerCharacter', system);
    actor._prepareMovement();
    expect(actor.system.movement.burrow.total).toBe(25);
  });

  test("burrow honours bonus and morphed the same way ground does", () => {
    const system = movementSystem({ isMorphed: true });
    system.movement.burrow = { base: 25, bonus: 5, morphed: 10, altMode: 0 };
    const actor = makeActor('playerCharacter', system);
    actor._prepareMovement();
    expect(actor.system.movement.burrow.total).toBe(40);
  });
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

  describe("Warrior Rush (Transformers CRB Wrecker Focus, 1st level, p.92)", () => {
    const WARRIOR_RUSH_ID = "Compendium.essence20.tf_crb.Item.jTNi4jENlLEq8ruS";

    afterEach(() => {
      game.combat = null;
    });

    test("doubles every movement type's total in round 1 of combat, with the Perk", () => {
      game.combat = { round: 1 };
      const actor = makeActor('playerCharacter', movementSystem(), {
        perk: [{ type: 'perk', flags: { core: { sourceId: WARRIOR_RUSH_ID } } }],
      });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(70); // 35 * 2
    });

    test("doesn't double outside of round 1", () => {
      game.combat = { round: 2 };
      const actor = makeActor('playerCharacter', movementSystem(), {
        perk: [{ type: 'perk', flags: { core: { sourceId: WARRIOR_RUSH_ID } } }],
      });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });

    test("doesn't double without the Perk, even in round 1", () => {
      game.combat = { round: 1 };
      const actor = makeActor('playerCharacter', movementSystem());
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });

    test("doesn't double outside of combat entirely", () => {
      const actor = makeActor('playerCharacter', movementSystem(), {
        perk: [{ type: 'perk', flags: { core: { sourceId: WARRIOR_RUSH_ID } } }],
      });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });
  });

  describe("Thunderous Advance (GI Joe CRB, Mechanized Infantry Focus, 7th level, p.81)", () => {
    const THUNDEROUS_ADVANCE_ID = "Compendium.essence20.gi_joe_crb.Item.B0yM8ewEoYJb1GBg";

    function makeVehicleActor({ driverHasPerk = true } = {}) {
      const driver = { items: driverHasPerk ? [{ type: 'perk', flags: { core: { sourceId: THUNDEROUS_ADVANCE_ID } } }] : [] };
      global.fromUuidSync.mockReturnValue(driver);
      return makeActor('vehicle', movementSystem({ actors: { a: { uuid: 'Actor.driver1', vehicleRole: 'driver' } } }));
    }

    afterEach(() => {
      game.combat = null;
      global.fromUuidSync.mockReset();
    });

    test("adds +15ft in combat while the driver holds the Perk", () => {
      game.combat = { round: 1 };
      const vehicle = makeVehicleActor();
      vehicle._prepareMovement();
      expect(vehicle.system.movement.ground.total).toBe(50); // 35 base+bonus + 15
    });

    test("adds +20% out of combat", () => {
      game.combat = null;
      const vehicle = makeVehicleActor();
      vehicle._prepareMovement();
      expect(vehicle.system.movement.ground.total).toBe(42); // 35 + round(35 * 0.2) = 35 + 7
    });

    test("doesn't apply without a driver holding the Perk, or on a non-vehicle", () => {
      game.combat = { round: 1 };
      const noPerkVehicle = makeVehicleActor({ driverHasPerk: false });
      noPerkVehicle._prepareMovement();
      expect(noPerkVehicle.system.movement.ground.total).toBe(35);

      const character = makeActor('playerCharacter', movementSystem());
      character._prepareMovement();
      expect(character.system.movement.ground.total).toBe(35);
    });
  });

  describe("Rush the Line (Factions in Action Vol. 2, Renegade Focus, p.68)", () => {
    const RUSH_THE_LINE_ID = "Compendium.essence20.intercontinental_adventures.Item.va1HF5CudO4WsguB";

    function makeRushTheLineActor({ hasPerk = true, active = true } = {}) {
      const actor = makeActor('playerCharacter', movementSystem(), {
        perk: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: RUSH_THE_LINE_ID } } }] : [],
      });
      actor.getFlag = jest.fn((scope, key) => (key == 'rushTheLineActive' ? active : undefined));
      return actor;
    }

    test("doubles ground Movement's total with the Perk and the flag active", () => {
      const actor = makeRushTheLineActor();
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(70); // 35 * 2
    });

    test("doesn't double aerial Movement (ground only)", () => {
      const actor = makeRushTheLineActor();
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(0); // base 0 + bonus 0, not doubled
    });

    test("doesn't double without the Perk, even with the flag active", () => {
      const actor = makeRushTheLineActor({ hasPerk: false });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });

    test("doesn't double with the Perk but the flag inactive", () => {
      const actor = makeRushTheLineActor({ active: false });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });
  });

  describe("Frictionless Movement (Technorganic Secrets, Mutant Beast Influence Perk, p.47)", () => {
    const FRICTIONLESS_MOVEMENT_ID = "Compendium.essence20.technorganic_secrets.Item.9fOrSAd3brtSBk9C";

    function makeFrictionlessMovementActor({ hasPerk = true, active = true } = {}) {
      const actor = makeActor(
        'playerCharacter',
        movementSystem({ movement: { ...movementSystem().movement, aerial: { base: 20, bonus: 0, morphed: 0, altMode: 0 } } }),
        { perk: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: FRICTIONLESS_MOVEMENT_ID } } }] : [] },
      );
      actor.getFlag = jest.fn((scope, key) => (key == 'frictionlessMovementActive' ? active : undefined));
      return actor;
    }

    test("doubles EVERY Movement type's total with the Perk and the flag active", () => {
      const actor = makeFrictionlessMovementActor();
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(70); // 35 * 2
      expect(actor.system.movement.aerial.total).toBe(40); // 20 * 2
    });

    test("doesn't double without the Perk, even with the flag active", () => {
      const actor = makeFrictionlessMovementActor({ hasPerk: false });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
      expect(actor.system.movement.aerial.total).toBe(20);
    });

    test("doesn't double with the Perk but the flag inactive", () => {
      const actor = makeFrictionlessMovementActor({ active: false });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
      expect(actor.system.movement.aerial.total).toBe(20);
    });
  });

  describe("The Tough Get Going (Factions in Action Vol. 2, Oktober Guard General Perk, p.95)", () => {
    function makeToughGetGoingActor(active) {
      const actor = makeActor('playerCharacter', movementSystem());
      actor.getFlag = jest.fn((scope, key) => (key == 'theToughGetGoingActive' ? active : undefined));
      return actor;
    }

    afterEach(() => {
      game.combat = null;
    });

    test("doubles ground Movement while the window is active this round", () => {
      game.combat = { round: 1 };
      const actor = makeToughGetGoingActor({ round: 1 });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(70); // 35 * 2
    });

    test("doesn't double aerial Movement (ground only)", () => {
      game.combat = { round: 1 };
      const actor = makeToughGetGoingActor({ round: 1 });
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(0);
    });

    test("doesn't double once the round has advanced", () => {
      game.combat = { round: 2 };
      const actor = makeToughGetGoingActor({ round: 1 });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });

    test("doesn't double with no active window", () => {
      game.combat = { round: 1 };
      const actor = makeToughGetGoingActor(undefined);
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });
  });

  describe("Engine Override (Factions in Action Vol. 2, Engineer Troop Focus, 3rd level, p.72)", () => {
    function makeBoostedVehicle(round) {
      const actor = makeActor('vehicle', movementSystem());
      actor.getFlag = jest.fn((scope, key) => (
        key == 'pendingEngineOverrideBoost' ? { round } : undefined
      ));
      return actor;
    }

    afterEach(() => {
      game.combat = null;
    });

    test("adds +15ft to ground Movement while the boost is active this round", () => {
      game.combat = { round: 3 };
      const actor = makeBoostedVehicle(3);
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(50); // 35 + 15
    });

    test("doesn't add the boost once the round has advanced past the granting round", () => {
      game.combat = { round: 4 };
      const actor = makeBoostedVehicle(3);
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });

    test("doesn't affect aerial Movement (ground only)", () => {
      game.combat = { round: 3 };
      const actor = makeBoostedVehicle(3);
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(0);
    });

    test("applies outside of combat when granted outside of combat", () => {
      game.combat = null;
      const actor = makeBoostedVehicle(null);
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(50);
    });

    test("no boost with no flag set", () => {
      const actor = makeActor('vehicle', movementSystem());
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });
  });

  describe("Hup! Hup! Hup! Hup! Hup! (Sgt Slaughter Sourcebook, Drill Instructor Focus, Officer, 6th level, p.10)", () => {
    function makeBoostedAlly(expiresRound) {
      const actor = makeActor('playerCharacter', movementSystem());
      actor.getFlag = jest.fn((scope, key) => (
        key == 'pendingHupHupHupHupHupBonus' ? { bonus: 20, expiresRound } : undefined
      ));
      return actor;
    }

    afterEach(() => {
      game.combat = null;
    });

    test("adds the banked bonus to ground Movement while still active", () => {
      game.combat = { round: 2 };
      const actor = makeBoostedAlly(2);
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(55); // 35 + 20
    });

    test("doesn't add the bonus once the round has advanced past expiresRound", () => {
      game.combat = { round: 4 };
      const actor = makeBoostedAlly(2);
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });

    test("no bonus with no flag set", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });
  });

  describe("Jury Rig - Engine Turbo-Boost / Watertight Seals (Factions in Action Vol. 2, Engineer Troop Focus, 17th level, p.73)", () => {
    function makeJuryRigVehicle(option) {
      const actor = makeActor('vehicle', movementSystem());
      actor.getFlag = jest.fn((scope, key) => (
        key == 'pendingJuryRigBenefit' ? { option, expiresRound: 99 } : undefined
      ));
      return actor;
    }

    test("Engine Turbo-Boost sets Aerial Movement equal to Ground Movement's base + bonus", () => {
      const actor = makeJuryRigVehicle('engineTurboBoost');
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(35); // 30 (base) + 5 (bonus)
    });

    test("Engine Turbo-Boost doesn't affect Aquatic (swim) Movement", () => {
      const actor = makeJuryRigVehicle('engineTurboBoost');
      actor._prepareMovement();
      expect(actor.system.movement.swim.total).toBe(15); // unaffected default half-ground fallback
    });

    test("Watertight Seals sets Aquatic Movement equal to Ground Movement's base + bonus", () => {
      const actor = makeJuryRigVehicle('watertightSeals');
      actor._prepareMovement();
      expect(actor.system.movement.swim.total).toBe(35); // 30 (base) + 5 (bonus)
    });

    test("neither applies with an unrelated benefit active", () => {
      const actor = makeJuryRigVehicle('hardenArmor');
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(0);
      expect(actor.system.movement.swim.total).toBe(15);
    });
  });

  describe("Bulwark (GI Joe CRB, Tank Focus, 17th level, p.99)", () => {
    const BULWARK_ID = "Compendium.essence20.gi_joe_crb.Item.7758n3XWOzhSjdOk";

    function makeBulwarkActor({ hasPerk = true, planted = true } = {}) {
      const actor = makeActor('playerCharacter', movementSystem(), {
        perk: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: BULWARK_ID } } }] : [],
      });
      actor.getFlag = jest.fn((scope, key) => (key == 'bulwarkActive' ? planted : undefined));
      return actor;
    }

    test("zeroes every movement type's total while planted, with the Perk", () => {
      const actor = makeBulwarkActor();
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(0);
      expect(actor.system.movement.climb.total).toBe(0);
      expect(actor.system.movement.swim.total).toBe(0);
    });

    test("doesn't zero without the Perk, even while the (unrelated) flag is true", () => {
      const actor = makeBulwarkActor({ hasPerk: false });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });

    test("doesn't zero while not planted", () => {
      const actor = makeBulwarkActor({ planted: false });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });
  });

  describe("Skier (General Hawk's Personnel Files, General Perk, p.175)", () => {
    const SKIER_ID = "Compendium.essence20.general_hawk_s_personel_files.Item.dvmY7UiuKejOPY4N";

    function makeSkierActor({ hasPerk = true, skiing = true } = {}) {
      const actor = makeActor('playerCharacter', movementSystem(), {
        perk: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: SKIER_ID } } }] : [],
      });
      actor.getFlag = jest.fn((scope, key) => (key == 'isSkiingActive' ? skiing : undefined));
      return actor;
    }

    test("adds +10 to Ground Movement while skiing, with the Perk", () => {
      const actor = makeSkierActor();
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(45); // 35 + 10
    });

    test("doesn't apply without the Perk, even while the (unrelated) flag is true", () => {
      const actor = makeSkierActor({ hasPerk: false });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });

    test("doesn't apply while not skiing", () => {
      const actor = makeSkierActor({ skiing: false });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });
  });

  describe("Wire Work (GI Joe CRB, Commando base, Infiltrator Focus, 6th level, p.73)", () => {
    const WIRE_WORK_ID = "Compendium.essence20.gi_joe_crb.Item.TGqWGjDUy24SPSGZ";

    test("sets Climb Movement equal to Ground Movement, with the Perk", () => {
      const actor = makeActor('playerCharacter', movementSystem(), {
        perk: [{ type: 'perk', flags: { core: { sourceId: WIRE_WORK_ID } } }],
      });
      actor._prepareMovement();
      expect(actor.system.movement.climb.total).toBe(actor.system.movement.ground.total);
    });

    test("doesn't override Climb Movement without the Perk", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor._prepareMovement();
      expect(actor.system.movement.climb.total).not.toBe(actor.system.movement.ground.total);
    });
  });

  describe("Amphibious Assault (Quartermaster's Guide to Gear, Freebooter Focus, Renegade, 1st level, p.24)", () => {
    const AMPHIBIOUS_ASSAULT_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.X2atZm3eoIBJcwF6";

    test("sets Aquatic Movement equal to Ground Movement, with no prior Aquatic Movement", () => {
      const actor = makeActor('playerCharacter', movementSystem(), {
        perk: [{ type: 'perk', flags: { core: { sourceId: AMPHIBIOUS_ASSAULT_ID } } }],
      });
      actor._prepareMovement();
      expect(actor.system.movement.swim.total).toBe(actor.system.movement.ground.total);
    });

    test("increases the better of Aquatic/Ground Movement by 15ft, with a prior Aquatic Movement", () => {
      const actor = makeActor(
        'playerCharacter',
        movementSystem({ movement: { ...movementSystem().movement, swim: { base: 50, bonus: 0, morphed: 0, altMode: 0 } } }),
        { perk: [{ type: 'perk', flags: { core: { sourceId: AMPHIBIOUS_ASSAULT_ID } } }] },
      );
      actor._prepareMovement();
      // Ground totals 35 (base 30 + bonus 5), so the pre-existing Aquatic 50 is already the
      // better option - +15 on top of that, not the Ground total.
      expect(actor.system.movement.swim.total).toBe(65);
    });

    test("doesn't apply without the Perk", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor._prepareMovement();
      expect(actor.system.movement.swim.total).not.toBe(actor.system.movement.ground.total);
    });
  });

  describe("Field Aid (GI Joe CRB, Focus: Medic, 3rd level, p.82)", () => {
    const FIELD_AID_ID = "Compendium.essence20.gi_joe_crb.Item.5JUC0fO9hUIJFP6u";

    function makeFieldAidActor({ hasPerk = true, defeatedAllyNearby = true } = {}) {
      const actorToken = { document: { disposition: 1 }, center: {} };
      const actor = makeActor('playerCharacter', movementSystem(), {
        perk: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: FIELD_AID_ID } } }] : [],
      });
      actor.getActiveTokens = jest.fn(() => [actorToken]);
      global.canvas = {
        tokens: {
          placeables: defeatedAllyNearby
            ? [actorToken, { actor: { statuses: new Set(['defeated']) }, document: { disposition: 1 }, center: {} }]
            : [actorToken],
        },
        grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
      };
      return actor;
    }

    test("adds +10 Ground Movement with the Perk and a nearby Defeated ally", () => {
      const actor = makeFieldAidActor();
      const baseline = makeActor('playerCharacter', movementSystem());
      baseline._prepareMovement();
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(baseline.system.movement.ground.total + 10);
    });

    test("doesn't apply without the Perk", () => {
      const actor = makeFieldAidActor({ hasPerk: false });
      const baseline = makeActor('playerCharacter', movementSystem());
      baseline._prepareMovement();
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(baseline.system.movement.ground.total);
    });

    test("doesn't apply without a nearby Defeated ally", () => {
      const actor = makeFieldAidActor({ defeatedAllyNearby: false });
      const baseline = makeActor('playerCharacter', movementSystem());
      baseline._prepareMovement();
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(baseline.system.movement.ground.total);
    });
  });

  describe("Natural Movement (GI Joe CRB, Focus: Predator, 6th level, p.93)", () => {
    function makeNaturalMovementActor(type) {
      const actor = makeActor('playerCharacter', movementSystem());
      actor.getFlag = jest.fn((scope, key) => (key == 'naturalMovementType' ? type : undefined));
      return actor;
    }

    test("sets Climb Movement to half Ground Movement while active with 'climb' chosen", () => {
      const actor = makeNaturalMovementActor('climb');
      actor._prepareMovement();
      expect(actor.system.movement.climb.total).toBe(Math.floor(actor.system.movement.ground.total / 5 * .5) * 5);
    });

    test("sets Swim Movement to half Ground Movement while active with 'swim' chosen", () => {
      const actor = makeNaturalMovementActor('swim');
      actor._prepareMovement();
      expect(actor.system.movement.swim.total).toBe(Math.floor(actor.system.movement.ground.total / 5 * .5) * 5);
    });

    test("doesn't override Climb/Swim while inactive", () => {
      const actor = makeNaturalMovementActor(undefined);
      const baseline = makeActor('playerCharacter', movementSystem());
      baseline._prepareMovement();
      actor._prepareMovement();
      expect(actor.system.movement.climb.total).toBe(baseline.system.movement.climb.total);
      expect(actor.system.movement.swim.total).toBe(baseline.system.movement.swim.total);
    });
  });

  describe("Prowl (GI Joe CRB, Focus: Predator, 17th level, p.94)", () => {
    const PROWL_ID = "Compendium.essence20.gi_joe_crb.Item.ZCOzxoy7d3P5izBB";
    const ENVIRONMENTAL_EXPERTISE_ID = "Compendium.essence20.gi_joe_crb.Item.EbbSUA2vSHyv3MjQ";

    function makeProwlActor({ hasProwl = true, hasExpertise = true, active = true } = {}) {
      const items = [];
      if (hasProwl) {
        items.push({ type: 'perk', flags: { core: { sourceId: PROWL_ID } } });
      }

      if (hasExpertise) {
        items.push({ type: 'perk', flags: { core: { sourceId: ENVIRONMENTAL_EXPERTISE_ID } } });
      }

      const actor = makeActor('playerCharacter', movementSystem(), { perk: items });
      actor.getFlag = jest.fn((scope, key) => (key == 'environmentalExpertiseActive' ? active : undefined));
      return actor;
    }

    test("doubles Ground Movement with the Perk and expertise active", () => {
      const actor = makeProwlActor();
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(70); // 35 (30 base + 5 bonus) * 2
    });

    test("doesn't double without the Perk, even with expertise active", () => {
      const actor = makeProwlActor({ hasProwl: false });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });

    test("doesn't double when expertise is inactive, even with the Perk", () => {
      const actor = makeProwlActor({ active: false });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });
  });

  describe("Quantum Master (A Jump Through Time, Quantum Ranger, 20th level, p.47)", () => {
    const QUANTUM_MASTER_ID = "Compendium.essence20.jump_through_time.Item.YlHp7yzbOsytNUjD";

    test("doubles every movement type's total while Morphed, with the Perk", () => {
      const actor = makeActor('playerCharacter', movementSystem({ isMorphed: true }), {
        perk: [{ type: 'perk', flags: { core: { sourceId: QUANTUM_MASTER_ID } } }],
      });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(90); // (30 base + 5 bonus + 10 morphed = 45) * 2
    });

    test("doesn't double without the Perk, even while Morphed", () => {
      const actor = makeActor('playerCharacter', movementSystem({ isMorphed: true }));
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(45);
    });

    test("doesn't double while not Morphed, even with the Perk", () => {
      const actor = makeActor('playerCharacter', movementSystem(), {
        perk: [{ type: 'perk', flags: { core: { sourceId: QUANTUM_MASTER_ID } } }],
      });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });
  });

  describe("Wisdom of the Elders - Lightfoil Wings (Through the Shattered Grid, Guardian of Eltar, 9th/18th level, p.72)", () => {
    test("sets Aerial Movement equal to Ground Movement's base+bonus+morphed while active and Morphed", () => {
      const actor = makeActor('playerCharacter', movementSystem({ isMorphed: true }));
      actor.getFlag = jest.fn((scope, key) => (key == 'wisdomOfTheEldersActive' ? { lightfoilWings: true } : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(45); // 30 base + 5 bonus + 10 morphed
    });

    test("excludes the morphed component while not Morphed", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor.getFlag = jest.fn((scope, key) => (key == 'wisdomOfTheEldersActive' ? { lightfoilWings: true } : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(35); // 30 base + 5 bonus
    });

    test("doesn't apply while inactive", () => {
      const actor = makeActor('playerCharacter', movementSystem({ isMorphed: true }));
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(0);
    });
  });

  describe("Animal Gait (Cobra Codex, Ranger Guerilla Focus, 6th level, p.61)", () => {
    test("sets Aerial Movement equal to Ground Movement's base+bonus+morphed while active, Morphed, and Aerial chosen", () => {
      const actor = makeActor('playerCharacter', movementSystem({ isMorphed: true }));
      actor.getFlag = jest.fn((scope, key) => (key == 'animalGaitMovementType' ? 'aerial' : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(45); // 30 base + 5 bonus + 10 morphed
    });

    test("sets Climb Movement equal to Ground Movement's total (processed after ground) when Climbing chosen", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor.getFlag = jest.fn((scope, key) => (key == 'animalGaitMovementType' ? 'climb' : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.climb.total).toBe(35); // same as ground.total
    });

    test("sets Swim Movement equal to Ground Movement's total when Swimming chosen", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor.getFlag = jest.fn((scope, key) => (key == 'animalGaitMovementType' ? 'swim' : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.swim.total).toBe(35);
    });

    test("doesn't apply while inactive", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(0);
      expect(actor.system.movement.climb.total).toBe(Math.floor(35 / 5 * .5) * 5);
    });
  });

  describe("Power Adaptation - Boost of Speed (Across the Stars, Silver Ranger, 9th/18th level, p.57)", () => {
    test("adds +20 to ground Movement while active", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor.getFlag = jest.fn((scope, key) => (key == 'powerAdaptationActive' ? { boostOfSpeed: true } : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(55); // 35 + 20
    });

    test("doesn't apply directly to non-ground movement types (climb/swim only see it indirectly, via ground.total)", () => {
      const actor = makeActor('playerCharacter', movementSystem({
        movement: {
          aerial: { base: 40, bonus: 0, morphed: 0, altMode: 0 },
          ground: { base: 30, bonus: 5, morphed: 10, altMode: 60 },
          burrow: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
          climb: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
          swim: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        },
      }));
      actor.getFlag = jest.fn((scope, key) => (key == 'powerAdaptationActive' ? { boostOfSpeed: true } : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(40); // unaffected - Boost of Speed is ground-only
    });

    test("doesn't apply while inactive", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor.getFlag = jest.fn((scope, key) => (key == 'powerAdaptationActive' ? { boostOfSpeed: false } : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });

    test("doesn't apply with no flag set at all", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });
  });

  describe("Over the Candlestick - Innate Climber (Technorganic Secrets, Climber/Nimble Origin Benefit, p.38)", () => {
    const OVER_THE_CANDLESTICK_ID = "Compendium.essence20.technorganic_secrets.Item.zKngKkwDyNv2nnH5";

    function makeOverTheCandlestickPerk(choice) {
      return { type: 'perk', flags: { core: { sourceId: OVER_THE_CANDLESTICK_ID } }, system: { choice } };
    }

    test("sets climb Movement to 40 in Alt Mode when Innate Climber was chosen, overriding the generic half-Ground climb fallback", () => {
      const actor = makeActor('playerCharacter', movementSystem({ isTransformed: true }), {
        perk: [makeOverTheCandlestickPerk('innateClimber')],
      });
      actor._prepareMovement();
      expect(actor.system.movement.climb.total).toBe(40);
    });

    test("doesn't apply outside Alt Mode, without the Perk, or when Agile Reflexes was chosen instead (climb falls back to half Ground)", () => {
      let actor = makeActor('playerCharacter', movementSystem(), {
        perk: [makeOverTheCandlestickPerk('innateClimber')],
      });
      actor._prepareMovement();
      expect(actor.system.movement.climb.total).toBe(15); // half of 35 Ground, not transformed - fallback only

      actor = makeActor('playerCharacter', movementSystem({ isTransformed: true }));
      actor._prepareMovement();
      expect(actor.system.movement.climb.total).toBe(30); // half of 65 Ground, no Perk - fallback only

      actor = makeActor('playerCharacter', movementSystem({ isTransformed: true }), {
        perk: [makeOverTheCandlestickPerk('agileReflexes')],
      });
      actor._prepareMovement();
      expect(actor.system.movement.climb.total).toBe(30); // fallback only, wrong choice made
    });
  });

  describe("Sprinter (Technorganic Secrets, Hunter's Prowess Quadruped Origin choice, p.44)", () => {
    const SPRINTER_ID = "Compendium.essence20.technorganic_secrets.Item.L5P54Ismw81Lhrbe";

    function makeSprinterPerk() {
      return { type: 'perk', flags: { core: { sourceId: SPRINTER_ID } } };
    }

    test("adds +20 to ground Movement in Alt Mode", () => {
      const actor = makeActor('playerCharacter', movementSystem({ isTransformed: true }), {
        perk: [makeSprinterPerk()],
      });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(85); // 65 + 20
    });

    test("doesn't apply outside Alt Mode, or without the Perk", () => {
      let actor = makeActor('playerCharacter', movementSystem(), { perk: [makeSprinterPerk()] });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);

      actor = makeActor('playerCharacter', movementSystem({ isTransformed: true }));
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(65);
    });

    test("doubles ground Movement while the once/scene boost is active", () => {
      const actor = makeActor('playerCharacter', movementSystem(), { perk: [makeSprinterPerk()] });
      actor.getFlag = jest.fn((scope, key) => (key == 'sprinterBoostActive' ? true : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(70); // 35 * 2
    });

    test("doesn't double without the boost active, or without the Perk", () => {
      let actor = makeActor('playerCharacter', movementSystem(), { perk: [makeSprinterPerk()] });
      actor.getFlag = jest.fn(() => undefined);
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);

      actor = makeActor('playerCharacter', movementSystem());
      actor.getFlag = jest.fn((scope, key) => (key == 'sprinterBoostActive' ? true : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });
  });

  describe("Sprinter (Transformers One Sourcebook, General Perk, p.19)", () => {
    const TF1S_SPRINTER_ID = "Compendium.essence20.transformers_one_sourcebook.Item.gbDY8UiTgSNZHPAo";

    function makeTf1sSprinterPerk() {
      return { type: 'perk', flags: { core: { sourceId: TF1S_SPRINTER_ID } } };
    }

    test("adds +5 to ground Movement in Bot Mode", () => {
      const actor = makeActor('playerCharacter', movementSystem(), { perk: [makeTf1sSprinterPerk()] });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(40); // 35 + 5
    });

    test("doesn't apply in Alt Mode, or without the Perk", () => {
      let actor = makeActor('playerCharacter', movementSystem({ isTransformed: true }), {
        perk: [makeTf1sSprinterPerk()],
      });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(65);

      actor = makeActor('playerCharacter', movementSystem());
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });
  });

  describe("Swiftness (Quartermaster's Guide to Gear, Grid Power, p.94)", () => {
    test("adds +20 to ground Movement while active for ground", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor.getFlag = jest.fn((scope, key) => (key == 'swiftnessMovementType' ? 'ground' : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(55); // 35 + 20
    });

    test("adds +20 to aerial Movement while active for aerial", () => {
      const actor = makeActor('playerCharacter', movementSystem({
        movement: {
          aerial: { base: 5, bonus: 0, morphed: 0, altMode: 0 },
          ground: { base: 30, bonus: 5, morphed: 10, altMode: 60 },
          burrow: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
          climb: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
          swim: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        },
      }));
      actor.getFlag = jest.fn((scope, key) => (key == 'swiftnessMovementType' ? 'aerial' : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(25); // 5 + 20
    });

    test("doesn't apply with no flag set at all", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });
  });

  describe("Fluttery Wings (MLP CRB, Elementary Aid spell, p.136)", () => {
    test("adds +15 to Aerial Movement while active", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor.getFlag = jest.fn((scope, key) => (key == 'flutteryWingsActive' ? true : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(15); // 0 + 15
    });

    test("doesn't apply while inactive", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(0);
    });
  });

  describe("Hot To Trot (Knights of Canterlot, Elementary Enchantment spell, p.43)", () => {
    test("adds +15 to ground Movement while active", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor.getFlag = jest.fn((scope, key) => (key == 'hotToTrotActive' ? true : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(50); // 35 + 15
    });

    test("doesn't apply while inactive", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });
  });

  describe("Lightning Speed (MLP CRB, Virtuoso Utility spell, p.139)", () => {
    test("doubles every Movement type while active", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor.getFlag = jest.fn((scope, key) => (key == 'lightningSpeedActive' ? true : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(70); // 35 * 2
    });

    test("doesn't apply while inactive", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });
  });

  describe("Mobile Mode (Through the Shattered Grid, Grid Power, p.26)", () => {
    test("floors the chosen movement type at 30 while Morphed", () => {
      const actor = makeActor('playerCharacter', movementSystem({ isMorphed: true }));
      actor.getFlag = jest.fn((scope, key) => (key == 'mobileModeType' ? 'aerial' : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(30);
    });

    test("doesn't reduce an already-higher value", () => {
      const actor = makeActor('playerCharacter', movementSystem({ isMorphed: true }));
      actor.getFlag = jest.fn((scope, key) => (key == 'mobileModeType' ? 'ground' : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(45); // 30 base + 5 bonus + 10 morphed, unaffected
    });

    test("doesn't apply while not Morphed", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor.getFlag = jest.fn((scope, key) => (key == 'mobileModeType' ? 'aerial' : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(0);
    });

    test("doesn't apply without the flag set", () => {
      const actor = makeActor('playerCharacter', movementSystem({ isMorphed: true }));
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(0);
    });
  });

  describe("Eltarian Training (Through the Shattered Grid, General Perk, p.73)", () => {
    const ELTARIAN_TRAINING_ID = "Compendium.essence20.through_the_shattered_grid.Item.NXxiyoOB60ems444";

    test("adds +10 to ground Movement, with the Perk", () => {
      const actor = makeActor('playerCharacter', movementSystem(), {
        perk: [{ type: 'perk', flags: { core: { sourceId: ELTARIAN_TRAINING_ID } } }],
      });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(45); // 35 + 10
    });

    test("doesn't apply directly to non-ground movement types", () => {
      const actor = makeActor('playerCharacter', movementSystem({
        movement: {
          aerial: { base: 40, bonus: 0, morphed: 0, altMode: 0 },
          ground: { base: 30, bonus: 5, morphed: 10, altMode: 60 },
          burrow: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
          climb: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
          swim: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        },
      }), {
        perk: [{ type: 'perk', flags: { core: { sourceId: ELTARIAN_TRAINING_ID } } }],
      });
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(40); // unaffected - Eltarian Training is ground-only
    });

    test("doesn't apply without the Perk", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35);
    });
  });

  describe("Air Born (MLP Pegasus Origin Perk, p.37)", () => {
    const AIR_BORN_ID = "Compendium.essence20.mlp_crb.Item.ekWiJObUf2BAhevg";

    test("overrides ground/aerial base to the chosen pair (aerial-heavy)", () => {
      const actor = makeActor('playerCharacter', movementSystem(), {
        perk: [{ type: 'perk', flags: { core: { sourceId: AIR_BORN_ID } }, system: { choice: 'aerialHeavy' } }],
      });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(50); // 45 base + 5 bonus
      expect(actor.system.movement.aerial.total).toBe(15); // 15 base + 0 bonus
    });

    test("overrides to the balanced pair", () => {
      const actor = makeActor('playerCharacter', movementSystem(), {
        perk: [{ type: 'perk', flags: { core: { sourceId: AIR_BORN_ID } }, system: { choice: 'balanced' } }],
      });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35); // 30 base + 5 bonus
      expect(actor.system.movement.aerial.total).toBe(30); // 30 base + 0 bonus
    });

    test("doesn't apply without the Perk", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35); // unaffected - original base of 30 + 5 bonus
    });
  });

  describe("Static Electricity (WTNV Citizen's Guide, General Perk, p.51)", () => {
    const STATIC_ELECTRICITY_ID = "Compendium.essence20.wtnv_citizens_guide.Item.mF6zMzGIfxQgJF9B";

    test("overrides ground Movement's base to 35ft", () => {
      const actor = makeActor('playerCharacter', movementSystem(), {
        perk: [{ type: 'perk', flags: { core: { sourceId: STATIC_ELECTRICITY_ID } } }],
      });
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(40); // 35 base + 5 bonus
    });

    test("doesn't apply without the Perk", () => {
      const actor = makeActor('playerCharacter', movementSystem());
      actor._prepareMovement();
      expect(actor.system.movement.ground.total).toBe(35); // unaffected - original base of 30 + 5 bonus
    });
  });

  describe("Gravity Optional (WTNV Citizen's Guide, Soldier Role, p.37)", () => {
    const GRAVITY_OPTIONAL_ID = "Compendium.essence20.wtnv_citizens_guide.Item.F5mrzupd6TG2kj3x";

    test("overrides aerial Movement's base to 5ft + 5 per 5 levels while active", () => {
      const actor = makeActor('playerCharacter', movementSystem({ level: 12 }), {
        perk: [{ type: 'perk', flags: { core: { sourceId: GRAVITY_OPTIONAL_ID } } }],
      });
      actor.getFlag = jest.fn((scope, key) => (key == 'gravityOptionalActive' ? true : undefined));
      actor._prepareMovement();
      expect(actor.system.movement.aerial.total).toBe(15); // 5 + 5*floor(12/5) = 15, + 0 bonus
    });

    test("doesn't apply without the Perk, or while inactive", () => {
      const actorNoPerk = makeActor('playerCharacter', movementSystem({ level: 12 }));
      actorNoPerk.getFlag = jest.fn((scope, key) => (key == 'gravityOptionalActive' ? true : undefined));
      actorNoPerk._prepareMovement();
      expect(actorNoPerk.system.movement.aerial.total).toBe(0);

      const actorInactive = makeActor('playerCharacter', movementSystem({ level: 12 }), {
        perk: [{ type: 'perk', flags: { core: { sourceId: GRAVITY_OPTIONAL_ID } } }],
      });
      actorInactive.getFlag = jest.fn((scope, key) => (key == 'gravityOptionalActive' ? false : undefined));
      actorInactive._prepareMovement();
      expect(actorInactive.system.movement.aerial.total).toBe(0);
    });
  });

  test("flags movementNotSet when every movement type totals 0", () => {
    const actor = makeActor('playerCharacter', movementSystem({
      movement: {
        aerial: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        ground: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        burrow: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        climb: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        swim: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
      },
    }));
    actor._prepareMovement();
    expect(actor.system.movementNotSet).toBe(true);
  });

  test("clears movementNotSet once a movement type has a nonzero total", () => {
    // A stuck-true flag was the actual bug behind a Megaform whose participants had already
    // supplied real Movement - Foundry's derived-data pass mutates the same system.movement
    // object across renders rather than resetting it from schema defaults each time, so a prior
    // "no participants yet" pass leaves movementNotSet stuck true unless this pass explicitly
    // clears it back to false too, not just sets it true.
    const actor = makeActor('playerCharacter', movementSystem());
    actor.system.movementNotSet = true;
    actor._prepareMovement();
    expect(actor.system.movementNotSet).toBe(false);
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

describe("_prepareEnergon", () => {
  const ENERGON_BATTERY_ID = "Compendium.essence20.tf_crb.Item.mRwjbhGpqWu7hqDM";

  function energonSystem(overrides = {}) {
    return {
      canTransform: true,
      essences: {
        strength: { value: 3 },
        speed: { value: 5 },
        smarts: { value: 2 },
        social: { value: 4 },
      },
      energon: { normal: { max: 0 } },
      ...overrides,
    };
  }

  test("caps Energon at the lowest Essence Score by default", () => {
    const actor = makeActor('playerCharacter', energonSystem());
    actor._prepareEnergon();
    expect(actor.system.energon.normal.max).toBe(2);
  });

  test("Energon Battery caps it at the highest Essence Score instead", () => {
    const actor = makeActor('playerCharacter', energonSystem(), {
      perk: [{ type: 'perk', flags: { core: { sourceId: ENERGON_BATTERY_ID } } }],
    });
    actor._prepareEnergon();
    expect(actor.system.energon.normal.max).toBe(5);
  });

  test("non-transforming actors are left untouched", () => {
    const actor = makeActor('vehicle', energonSystem({ canTransform: false, energon: { normal: { max: 99 } } }));
    actor._prepareEnergon();
    expect(actor.system.energon.normal.max).toBe(99);
  });

  describe("Organic Energon (Field Guide to Action and Adventure, General Perk, p.71)", () => {
    const ORGANIC_ENERGON_ID = "Compendium.essence20.field_guide_action_adventure.Item.ic1SwixGi3tstr5y";

    test("grants half the lowest Essence Score as an Energon pool to a non-transforming actor", () => {
      const actor = makeActor('playerCharacter', energonSystem({ canTransform: false, energon: { normal: { max: 99 } } }), {
        perk: [{ type: 'perk', flags: { core: { sourceId: ORGANIC_ENERGON_ID } } }],
      });
      actor._prepareEnergon();
      expect(actor.system.energon.normal.max).toBe(1); // floor(2 / 2)
    });

    test("doesn't apply without the Perk", () => {
      const actor = makeActor('playerCharacter', energonSystem({ canTransform: false, energon: { normal: { max: 99 } } }));
      actor._prepareEnergon();
      expect(actor.system.energon.normal.max).toBe(99);
    });

    test("doesn't override a transforming actor's own Energon Battery logic", () => {
      const actor = makeActor('playerCharacter', energonSystem(), {
        perk: [{ type: 'perk', flags: { core: { sourceId: ORGANIC_ENERGON_ID } } }],
      });
      actor._prepareEnergon();
      expect(actor.system.energon.normal.max).toBe(2); // still the lowest Essence Score, unhalved
    });
  });

  describe("Spark of the Ancients (Enigma of Combination, General Perk, p.41)", () => {
    // No longer computed here: the Perk carries an ordinary Active Effect targeting
    // system.energon.normal.max, applied in the FINAL phase so it lands after this method has
    // assigned the pool. What this method owes that effect is a clean, fully-computed maximum
    // with nothing Perk-specific folded in - which is what these two assert.
    test("computes the pool from Essences alone, leaving room for a final-phase effect", () => {
      const actor = makeActor('playerCharacter', energonSystem());
      actor._prepareEnergon();
      expect(actor.system.energon.normal.max).toBe(2); // the lowest Essence, and nothing else
    });

    test("still defers to Energon Battery, which an effect then adds on top of", () => {
      const actor = makeActor('playerCharacter', energonSystem(), {
        perk: [{ type: 'perk', flags: { core: { sourceId: ENERGON_BATTERY_ID } } }],
      });
      actor._prepareEnergon();
      expect(actor.system.energon.normal.max).toBe(5); // the highest Essence, un-bonused
    });
  });
});

describe("_preparePersonalPowerSupply", () => {
  const PERSONAL_POWER_SUPPLY_ID = "Compendium.essence20.field_guide_action_adventure.Item.Uy3t5KLbeGHv08ho";

  function powerSystem(overrides = {}) {
    return {
      level: 1,
      powers: { personal: { max: 0, regeneration: 0, value: 0 } },
      ...overrides,
    };
  }

  test("grants a base pool of 1 and +2 regeneration at 1st level", () => {
    const actor = makeActor('playerCharacter', powerSystem(), {
      perk: [{ type: 'perk', flags: { core: { sourceId: PERSONAL_POWER_SUPPLY_ID } } }],
    });
    actor._preparePersonalPowerSupply();
    expect(actor.system.powers.personal.max).toBe(1);
    expect(actor.system.powers.personal.regeneration).toBe(2);
  });

  test("scales the pool by 1 every 5 levels, matching the book's own worked example", () => {
    const actor = makeActor('playerCharacter', powerSystem({ level: 6 }), {
      perk: [{ type: 'perk', flags: { core: { sourceId: PERSONAL_POWER_SUPPLY_ID } } }],
    });
    actor._preparePersonalPowerSupply();
    expect(actor.system.powers.personal.max).toBe(2);
  });

  test("adds on top of an already-Active-Effect-modified max, rather than overriding it", () => {
    const actor = makeActor('playerCharacter', powerSystem({ powers: { personal: { max: 3, regeneration: 1, value: 0 } } }), {
      perk: [{ type: 'perk', flags: { core: { sourceId: PERSONAL_POWER_SUPPLY_ID } } }],
    });
    actor._preparePersonalPowerSupply();
    expect(actor.system.powers.personal.max).toBe(4);
    expect(actor.system.powers.personal.regeneration).toBe(3);
  });

  test("doesn't apply without the Perk", () => {
    const actor = makeActor('playerCharacter', powerSystem());
    actor._preparePersonalPowerSupply();
    expect(actor.system.powers.personal.max).toBe(0);
    expect(actor.system.powers.personal.regeneration).toBe(0);
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

describe("_getBaseRole", () => {
  test("returns the actor's own base (non-additive) Role Item", () => {
    const actor = makeActor('playerCharacter', {}, {
      role: [{ name: "Technician", system: { isAdditive: false, skills: ["culture", "technology"] } }],
    });
    expect(actor._getBaseRole()?.name).toBe("Technician");
  });

  test("skips an additive Role (e.g. Old Hand)", () => {
    const actor = makeActor('playerCharacter', {}, {
      role: [
        { name: "Old Hand", system: { isAdditive: true, skills: ["persuasion"] } },
        { name: "Infantry", system: { isAdditive: false, skills: ["athletics"] } },
      ],
    });
    expect(actor._getBaseRole()?.name).toBe("Infantry");
  });

  test("returns undefined without any Role Item", () => {
    const actor = makeActor('playerCharacter', {});
    expect(actor._getBaseRole()).toBeUndefined();
  });
});

describe("_prepareFireproofResistance (Cobra Codex, Ranger Firestarter Focus, p.58)", () => {
  const FIREPROOF_ID = "Compendium.essence20.cobra_codex.Item.gaOLMFlImcLRmQV0";

  function fireproofSystem(overrides = {}) {
    return { level: 3, resistances: {}, immunities: {}, ...overrides };
  }

  test("grants Fire Resistance below 10th level", () => {
    const actor = makeActor('playerCharacter', fireproofSystem({ level: 3 }), {
      perk: [{ type: 'perk', flags: { core: { sourceId: FIREPROOF_ID } } }],
    });
    actor._prepareFireproofResistance();
    expect(actor.system.resistances.fire).toBe(true);
    expect(actor.system.immunities.fire).toBeUndefined();
  });

  test("upgrades to Fire Immunity at 10th level", () => {
    const actor = makeActor('playerCharacter', fireproofSystem({ level: 10 }), {
      perk: [{ type: 'perk', flags: { core: { sourceId: FIREPROOF_ID } } }],
    });
    actor._prepareFireproofResistance();
    expect(actor.system.resistances.fire).toBe(true);
    expect(actor.system.immunities.fire).toBe(true);
  });

  test("does nothing without the Perk", () => {
    const actor = makeActor('playerCharacter', fireproofSystem({ level: 10 }));
    actor._prepareFireproofResistance();
    expect(actor.system.resistances.fire).toBeUndefined();
    expect(actor.system.immunities.fire).toBeUndefined();
  });

  test("never clears an already-true Resistance/Immunity from another source", () => {
    const actor = makeActor(
      'playerCharacter', fireproofSystem({ level: 3, immunities: { fire: true } }),
    );
    actor._prepareFireproofResistance();
    expect(actor.system.immunities.fire).toBe(true);
  });
});

describe("prepareDerivedData", () => {
  test("computes player-character-specific derived data for a playerCharacter", () => {
    const actor = makeActor('playerCharacter', {
      level: 1,
      conditioning: 0,
      health: { bonus: 0, origin: 0 },
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
        burrow: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
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

  test("computes the same shared Health/Defenses/Movement for an npc, but skips PC-only fields", () => {
    // Health/Defenses/Movement now run for every actor type (see the standing hold this project
    // had on this code, project_essence20_active_effects memory) - only genuinely PC-specific
    // extras (Sorcerous Power, Role Points Resource, Poison Training, Fireproof) stay gated to
    // playerCharacter. This fixture deliberately omits `powers`/`poisonTraining`/`trained`/
    // `qualified` - if any of those PC-only methods ran against an npc missing them, they'd
    // throw, so this test doubles as proof they were correctly skipped.
    const actor = makeActor('npc', {
      conditioning: 0,
      health: { bonus: 0, origin: 5 },
      essences: {
        strength: { max: 3 }, speed: { max: 3 }, smarts: { max: 3 }, social: { max: 3 },
      },
      defenses: {
        toughness: { base: 10, armor: 0, bonus: 0, morphed: 0, shield: 0, essence: 'strength' },
        evasion: { base: 10, armor: 0, bonus: 0, morphed: 0, shield: 0, essence: 'speed' },
        willpower: { base: 10, armor: 0, bonus: 0, morphed: 0, shield: 0, essence: 'smarts' },
        cleverness: { base: 10, armor: 0, bonus: 0, morphed: 0, shield: 0, essence: 'social' },
      },
      movement: {
        aerial: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        ground: { base: 30, bonus: 0, morphed: 0, altMode: 0 },
        burrow: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        climb: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        swim: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
      },
    });

    actor.prepareDerivedData();

    expect(actor.system.health.max).toBe(5);
    expect(actor.system.defenses.toughness.total).toBe(13);
    expect(actor.system.movement.ground.total).toBe(30);
    expect(actor.system.powers).toBeUndefined();
  });

  test("doesn't throw for an actor type with no registered schema (e.g. a stray/invalid 'party' actor)", () => {
    // Foundry still calls prepareDerivedData() on a document whose own DataModel failed to
    // register/validate in some code paths (e.g. sidebar rendering), leaving system.health/
    // defenses/movement all undefined - _prepareHealth/_prepareDefenses/_prepareMovement now run
    // unconditionally for every type, so each needs its own defensive guard against that, rather
    // than assuming every actor.system it's handed matches one of this system's own 6 shapes.
    const actor = makeActor('party', {});
    expect(() => actor.prepareDerivedData()).not.toThrow();
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

describe("_prepareMegaformZordData", () => {
  function makeZordParticipant({
    name, health, healthMax = 10, strength = 3, speed = 2, megaformTraitItems = [], featureIds = [], stun = 0,
  }) {
    return {
      name,
      type: 'zord',
      items: [
        ...megaformTraitItems.map(system => ({ type: 'megaformTrait', system })),
        // Zord Features (Light Chassis, Hardened Chassis, ...) are matched by compendium
        // sourceId via actorHasZordFeature, not a system.type enum like megaformTrait items -
        // see helpers/zord-features.mjs's own doc comment.
        ...featureIds.map(sourceId => ({ type: 'feature', flags: { core: { sourceId } } })),
      ],
      system: {
        essences: { strength: { value: strength }, speed: { value: speed } },
        movement: { ground: { total: 40, base: 40 }, aerial: {}, climb: {}, swim: {} },
        health: { value: health, max: healthMax },
        stun: { value: stun },
      },
      // Stands in for the real Actor#prepareData() call the Megaform forces on each participant
      // before reading it (see actor.mjs's own comment) - a no-op here since this fixture's
      // system data is already in its final, "already prepared" shape.
      prepareData() {},
    };
  }

  function makeMegazordActor(participants) {
    const actorsMap = {};
    participants.forEach((_participant, i) => {
      actorsMap[`z${i}`] = { uuid: `Actor.z${i}` };
    });
    global.fromUuidSync.mockImplementation(uuid => {
      const index = parseInt(uuid.replace('Actor.z', ''), 10);
      return participants[index];
    });

    return makeActor('megaform', {
      actors: actorsMap,
      essences: { strength: {}, speed: {} },
      defenses: { toughness: {}, evasion: {} },
      movement: { ground: {}, aerial: {}, climb: {}, swim: {} },
      health: {},
      stun: {},
      immunities: {},
      resistances: {},
    });
  }

  beforeEach(() => {
    global.fromUuidSync.mockReset();
  });

  // Regression: _prepareHealth used to add the Megaform's own Conditioning on top of
  // combinedHealthMax, which already includes each participant's. The tests around this one
  // check combinedHealthMax straight out of _prepareMegaformZordData and so never saw it -
  // this one runs _prepareHealth after it, the way prepareDerivedData does.
  test("health.max is the combined total plus only the GM bonus - Conditioning is not added again", () => {
    const a = makeZordParticipant({ name: 'A', health: 6, healthMax: 6 });
    const b = makeZordParticipant({ name: 'B', health: 7, healthMax: 7 });
    const actor = makeMegazordActor([a, b]);
    actor.system.conditioning = 3;
    actor.system.health.bonus = 2;

    actor._prepareMegaformZordData();
    actor._prepareHealth();

    expect(actor.system.combinedHealthMax).toBe(13);
    expect(actor.system.health.max).toBe(13 + 2);
    // Undamaged, so the token bar reads full.
    expect(actor.system.health.value).toBe(13);
  });

  test("doubles a Core Body participant's own Health share", () => {
    const coreBody = makeZordParticipant({ name: 'A', health: 5, healthMax: 5, megaformTraitItems: [{ type: 'coreBody' }] });
    const plain = makeZordParticipant({ name: 'B', health: 4, healthMax: 4 });
    const actor = makeMegazordActor([coreBody, plain]);

    actor._prepareMegaformZordData();

    expect(actor.system.combinedHealthMax).toBe((5 * 2) + 4);
    expect(actor.system.combinedHealthValue).toBe((5 * 2) + 4);
  });

  test("Layered Systems (Across the Stars, p.105) adds to just its own holder's share, after Core Body doubling", () => {
    const coreBody = makeZordParticipant({
      name: 'A', health: 5, healthMax: 5,
      megaformTraitItems: [{ type: 'coreBody' }, { type: 'layeredSystems', value: 3 }],
    });
    const actor = makeMegazordActor([coreBody]);

    actor._prepareMegaformZordData();

    expect(actor.system.combinedHealthMax).toBe((5 * 2) + 3);
  });

  test("Tenacious Bonds (A Jump Through Time, p.84) adds +1 Health to every participant once, not per holder", () => {
    const holder = makeZordParticipant({ name: 'A', health: 5, healthMax: 5, megaformTraitItems: [{ type: 'tenaciousBonds' }] });
    const otherHolder = makeZordParticipant({ name: 'B', health: 4, healthMax: 4, megaformTraitItems: [{ type: 'tenaciousBonds' }] });
    const plain = makeZordParticipant({ name: 'C', health: 3, healthMax: 3 });
    const actor = makeMegazordActor([holder, otherHolder, plain]);

    actor._prepareMegaformZordData();

    // 5+4+3 base, plus +1 per participant (3) applied ONCE despite two holders - not +6.
    expect(actor.system.combinedHealthMax).toBe(5 + 4 + 3 + 3);
  });

  test("Grounding (A Jump Through Time, p.84) grants EMP immunity to the whole Megaform", () => {
    const grounded = makeZordParticipant({ name: 'A', health: 5, megaformTraitItems: [{ type: 'grounding' }] });
    const actor = makeMegazordActor([grounded]);

    actor._prepareMegaformZordData();

    expect(actor.system.immunities.emp).toBe(true);
  });

  test("Resistant (Across the Stars, p.105) passes its chosen damage type's Resistance to the whole Megaform", () => {
    const resistant = makeZordParticipant({
      name: 'A', health: 5, megaformTraitItems: [{ type: 'resistant', damageType: 'fire' }],
    });
    const actor = makeMegazordActor([resistant]);

    actor._prepareMegaformZordData();

    expect(actor.system.resistances.fire).toBe(true);
  });

  test("Defender (Across the Stars, p.104) adds to Toughness only, not Evasion", () => {
    const defender = makeZordParticipant({
      name: 'A', health: 5, strength: 3, speed: 2, megaformTraitItems: [{ type: 'defender', value: 1 }],
    });
    const actor = makeMegazordActor([defender]);

    actor._prepareMegaformZordData();

    // .armor = base Armor(3) + Defender bonus(1) - the shared _prepareDefenses() (not called
    // directly by this unit test) adds base(10) + essence on top of this to reach the final
    // total of 17.
    expect(actor.system.defenses.toughness.armor).toBe(4);
    // No Evasion bonus from Defender - .armor stays at 0.
    expect(actor.system.defenses.evasion.armor).toBe(0);
  });

  describe("Light Chassis / Hardened Chassis (PR CRB, Zord Features, p.137/139)", () => {
    const LIGHT_CHASSIS_ID = "Compendium.essence20.pr_crb.Item.rVW7mvnV4MbGuxoq";
    const HARDENED_CHASSIS_ID = "Compendium.essence20.pr_crb.Item.7vwrFKj2UAxG4ocf";

    test("Light Chassis sets hasLightChassisInitiativeUpshift when any participant holds it", () => {
      const holder = makeZordParticipant({ name: 'A', health: 5, featureIds: [LIGHT_CHASSIS_ID] });
      const actor = makeMegazordActor([holder]);

      actor._prepareMegaformZordData();

      expect(actor.system.hasLightChassisInitiativeUpshift).toBe(true);
    });

    test("doesn't set the flag without a participant holding Light Chassis", () => {
      const holder = makeZordParticipant({ name: 'A', health: 5 });
      const actor = makeMegazordActor([holder]);

      actor._prepareMegaformZordData();

      expect(actor.system.hasLightChassisInitiativeUpshift).toBe(false);
    });

    test("resets to false with no participants", () => {
      const actor = makeMegazordActor([]);
      actor._prepareMegaformZordData();
      expect(actor.system.hasLightChassisInitiativeUpshift).toBe(false);
    });

    test("Hardened Chassis adds +1 to the Megaform's Armor bonus to Toughness only", () => {
      const holder = makeZordParticipant({ name: 'A', health: 5, featureIds: [HARDENED_CHASSIS_ID] });
      const actor = makeMegazordActor([holder]);

      actor._prepareMegaformZordData();

      // Base Armor(3) + Hardened Chassis(1) = 4 - same "armor, not bonus" shape as Defender's
      // own test just above.
      expect(actor.system.defenses.toughness.armor).toBe(4);
      expect(actor.system.defenses.evasion.armor).toBe(0);
    });

    test("stacks Hardened Chassis across multiple holders", () => {
      const a = makeZordParticipant({ name: 'A', health: 5, featureIds: [HARDENED_CHASSIS_ID] });
      const b = makeZordParticipant({ name: 'B', health: 5, featureIds: [HARDENED_CHASSIS_ID] });
      const actor = makeMegazordActor([a, b]);

      actor._prepareMegaformZordData();

      expect(actor.system.defenses.toughness.armor).toBe(5); // 3 base + 1 + 1
    });
  });

  test("Assault Weapon (A Jump Through Time, p.84) surfaces as a flag rather than auto-applying to an attack", () => {
    const assaultWeapon = makeZordParticipant({ name: 'A', health: 5, megaformTraitItems: [{ type: 'assaultWeapon' }] });
    const actor = makeMegazordActor([assaultWeapon]);

    actor._prepareMegaformZordData();

    expect(actor.system.hasAssaultWeapon).toBe(true);
  });

  test("Core Ability and Move still work alongside the new trait types", () => {
    const zord = makeZordParticipant({
      name: 'A', health: 5, strength: 3, speed: 2,
      megaformTraitItems: [
        { type: 'coreAbility', essence: 'strength', value: 2 },
        { type: 'move', movementType: 'aerial', value: 45 },
      ],
    });
    const actor = makeMegazordActor([zord]);

    actor._prepareMegaformZordData();

    expect(actor.system.essences.strength.value).toBe(5);
    // .total itself is left to the shared _prepareMovement() (not called directly by this unit
    // test) - this method is only responsible for .base now.
    expect(actor.system.movement.aerial.base).toBe(45);
  });

  test("Stun is summed fresh from every participant's own current value, not pooled", () => {
    const a = makeZordParticipant({ name: 'A', health: 5, stun: 2 });
    const b = makeZordParticipant({ name: 'B', health: 5, stun: 3 });
    const actor = makeMegazordActor([a, b]);

    actor._prepareMegaformZordData();

    expect(actor.system.stun.value).toBe(5);
  });

  test("also lists each participant's own current Stun individually, for the sidebar's per-member display", () => {
    const a = makeZordParticipant({ name: 'A', health: 5, stun: 2 });
    const b = makeZordParticipant({ name: 'B', health: 5, stun: 3 });
    const actor = makeMegazordActor([a, b]);

    actor._prepareMegaformZordData();

    expect(actor.system.participantStun).toEqual([
      { name: 'A', value: 2 },
      { name: 'B', value: 3 },
    ]);
  });

  test("Stun defaults to 0 with no participants", () => {
    const actor = makeMegazordActor([]);
    actor._prepareMegaformZordData();
    expect(actor.system.stun.value).toBe(0);
    expect(actor.system.participantStun).toEqual([]);
  });

  test("zeroes Essences/Defenses/Movement with no participants, instead of leaving them at their own zordBase-inherited schema defaults", () => {
    const actor = makeMegazordActor([]);
    actor._prepareMegaformZordData();

    expect(actor.system.essences.strength.value).toBe(0);
    expect(actor.system.essences.speed.value).toBe(0);
    expect(actor.system.defenses.toughness.base).toBe(0);
    expect(actor.system.defenses.toughness.armor).toBe(0);
    expect(actor.system.defenses.evasion.base).toBe(0);
    expect(actor.system.defenses.evasion.armor).toBe(0);
    expect(actor.system.movement.ground.base).toBe(0);
    expect(actor.system.movement.aerial.base).toBe(0);
  });
});

describe("_prepareMegaformCombinerData", () => {
  const KEEP_IT_TOGETHER_ID = "Compendium.essence20.enigma_of_combination.Item.9QdGh6Kfb1EVi4N7";
  const BETTER_AS_ONE_ID = "Compendium.essence20.enigma_of_combination.Item.XnmVJF4XNcsaXAKL";

  function makeComponent({ name, health, perkIds = [], athleticsSpecializations = {}, stun = 0 }) {
    return {
      name,
      type: 'playerCharacter',
      items: perkIds.map(id => ({ type: 'perk', flags: { core: { sourceId: id } } })),
      system: {
        size: 'common',
        essences: {
          strength: { value: 3 }, speed: { value: 2 }, smarts: { value: 2 }, social: { value: 2 },
        },
        skills: {
          athletics: { shift: 'd8', modifier: 0, specializations: athleticsSpecializations },
        },
        defenses: { toughness: { armor: 0 }, evasion: { armor: 0 } },
        movement: { ground: { total: 30, base: 30 } },
        health: { value: health, max: 10 },
        stun: { value: stun },
      },
      // See makeZordParticipant's identical stub above for why this is needed.
      prepareData() {},
    };
  }

  function makeCombinerActor(participants) {
    const actorsMap = {};
    participants.forEach((_participant, i) => {
      actorsMap[`p${i}`] = { uuid: `Actor.p${i}` }; 
    });
    global.fromUuidSync.mockImplementation(uuid => {
      const index = parseInt(uuid.replace('Actor.p', ''), 10);
      return participants[index];
    });

    return makeActor('megaform', {
      actors: actorsMap,
      essences: {
        strength: {}, speed: {}, smarts: {}, social: {},
      },
      skills: { athletics: { modifier: 0 } },
      defenses: { toughness: {}, evasion: {} },
      movement: { ground: {} },
      health: {},
      stun: {},
      energon: { normal: {} },
      energonSpentToMerge: 0,
      immunities: {},
      resistances: {},
    });
  }

  beforeEach(() => {
    global.fromUuidSync.mockReset();
  });

  test("zeroes Essences/Defenses/Movement with no participants, instead of leaving them at their own zordBase-inherited schema defaults", () => {
    const actor = makeCombinerActor([]);
    actor._prepareMegaformCombinerData();

    expect(actor.system.essences.strength.value).toBe(0);
    expect(actor.system.essences.smarts.value).toBe(0);
    expect(actor.system.defenses.toughness.base).toBe(0);
    expect(actor.system.defenses.toughness.armor).toBe(0);
    expect(actor.system.movement.ground.base).toBe(0);
  });

  describe("Keep it Together! (Component Ace Focus, 17th level, p.34)", () => {
    test("keeps the form together with a majority defeated, as long as a holder still has Health", () => {
      const holder = makeComponent({ name: 'Holder', health: 5, perkIds: [KEEP_IT_TOGETHER_ID] });
      const defeated1 = makeComponent({ name: 'Defeated1', health: 0 });
      const defeated2 = makeComponent({ name: 'Defeated2', health: 0 });
      const actor = makeCombinerActor([holder, defeated1, defeated2]);

      actor._prepareMegaformCombinerData();

      expect(actor.system.isDefeated).toBe(false);
    });

    test("still falls apart on a majority defeated without a standing holder", () => {
      const alive = makeComponent({ name: 'Alive', health: 5 });
      const defeated1 = makeComponent({ name: 'Defeated1', health: 0 });
      const defeated2 = makeComponent({ name: 'Defeated2', health: 0 });
      const actor = makeCombinerActor([alive, defeated1, defeated2]);

      actor._prepareMegaformCombinerData();

      expect(actor.system.isDefeated).toBe(true);
    });

    test("doesn't matter if the holder themselves is the one who's been defeated", () => {
      const holder = makeComponent({ name: 'Holder', health: 0, perkIds: [KEEP_IT_TOGETHER_ID] });
      const alive = makeComponent({ name: 'Alive', health: 5 });
      const defeated = makeComponent({ name: 'Defeated', health: 0 });
      const actor = makeCombinerActor([holder, alive, defeated]);

      actor._prepareMegaformCombinerData();

      expect(actor.system.isDefeated).toBe(true);
    });
  });

  describe("Better as One (Component Ace Focus, 10th level, p.34)", () => {
    test("merges a non-winning holder's own Specializations into the combined form's Skill", () => {
      const winner = makeComponent({
        name: 'Winner', health: 10, athleticsSpecializations: { sprint: { name: 'Sprint' } },
      });
      winner.system.essences.strength.value = 5;
      const holder = makeComponent({
        name: 'Holder', health: 10, perkIds: [BETTER_AS_ONE_ID],
        athleticsSpecializations: { climbing: { name: 'Climbing' } },
      });
      holder.system.essences.strength.value = 2;
      const actor = makeCombinerActor([winner, holder]);

      actor._prepareMegaformCombinerData();

      expect(actor.system.skills.athletics.specializations).toEqual({
        sprint: { name: 'Sprint' },
        climbing: { name: 'Climbing' },
      });
    });

    test("doesn't merge a non-winning component's Specializations without the Perk", () => {
      const winner = makeComponent({
        name: 'Winner', health: 10, athleticsSpecializations: { sprint: { name: 'Sprint' } },
      });
      winner.system.essences.strength.value = 5;
      const nonHolder = makeComponent({
        name: 'NonHolder', health: 10, athleticsSpecializations: { climbing: { name: 'Climbing' } },
      });
      nonHolder.system.essences.strength.value = 2;
      const actor = makeCombinerActor([winner, nonHolder]);

      actor._prepareMegaformCombinerData();

      expect(actor.system.skills.athletics.specializations).toEqual({ sprint: { name: 'Sprint' } });
    });
  });

  describe("new Megaform Trait types (Enigma of Combination reuses the same shared enum)", () => {
    function withTrait(component, system) {
      component.items = [...component.items, { type: 'megaformTrait', system }];
      return component;
    }

    test("Layered Systems adds a flat bonus to the combined Health total", () => {
      const withLayered = withTrait(
        makeComponent({ name: 'A', health: 10 }), { type: 'layeredSystems', value: 3 },
      );
      const plain = makeComponent({ name: 'B', health: 10 });
      const actor = makeCombinerActor([withLayered, plain]);

      actor._prepareMegaformCombinerData();

      expect(actor.system.combinedHealthMax).toBe(10 + 10 + 3);
    });

    test("Tenacious Bonds adds +1 Health per participant once, not per holder", () => {
      const holder1 = withTrait(makeComponent({ name: 'A', health: 10 }), { type: 'tenaciousBonds' });
      const holder2 = withTrait(makeComponent({ name: 'B', health: 10 }), { type: 'tenaciousBonds' });
      const plain = makeComponent({ name: 'C', health: 10 });
      const actor = makeCombinerActor([holder1, holder2, plain]);

      actor._prepareMegaformCombinerData();

      expect(actor.system.combinedHealthMax).toBe(10 + 10 + 10 + 3);
    });

    test("Grounding grants EMP immunity to the whole Combiner", () => {
      const grounded = withTrait(makeComponent({ name: 'A', health: 10 }), { type: 'grounding' });
      const actor = makeCombinerActor([grounded]);

      actor._prepareMegaformCombinerData();

      expect(actor.system.immunities.emp).toBe(true);
    });

    test("Resistant passes its chosen damage type's Resistance to the whole Combiner", () => {
      const resistant = withTrait(
        makeComponent({ name: 'A', health: 10 }), { type: 'resistant', damageType: 'fire' },
      );
      const actor = makeCombinerActor([resistant]);

      actor._prepareMegaformCombinerData();

      expect(actor.system.resistances.fire).toBe(true);
    });

    test("Defender adds to Toughness only, not Evasion", () => {
      const defender = withTrait(makeComponent({ name: 'A', health: 10 }), { type: 'defender', value: 1 });
      const actor = makeCombinerActor([defender]);

      actor._prepareMegaformCombinerData();

      // makeComponent defaults: Strength 3, Speed 2, 0 armor bonus. .armor = the components'
      // own min armor bonus (0) + Defender bonus(1) - the shared _prepareDefenses() (not called
      // directly by this unit test) adds base(10) + essence on top to reach the final total of
      // 14 for Toughness.
      expect(actor.system.defenses.toughness.armor).toBe(1);
      // No Defender bonus applied to Evasion - .armor stays at 0.
      expect(actor.system.defenses.evasion.armor).toBe(0);
    });

    test("Assault Weapon surfaces as a flag rather than auto-applying to an attack", () => {
      const assaultWeapon = withTrait(makeComponent({ name: 'A', health: 10 }), { type: 'assaultWeapon' });
      const actor = makeCombinerActor([assaultWeapon]);

      actor._prepareMegaformCombinerData();

      expect(actor.system.hasAssaultWeapon).toBe(true);
    });

    test("Enhanced Initiative surfaces as a flag for dice.mjs's own Initiative-Edge check", () => {
      const holder = withTrait(makeComponent({ name: 'A', health: 10 }), { type: 'enhancedInitiative' });
      const actor = makeCombinerActor([holder]);

      actor._prepareMegaformCombinerData();

      expect(actor.system.hasEnhancedInitiative).toBe(true);
    });

    test("Titan Hardpoint surfaces as a flag rather than auto-granting weapon access", () => {
      const holder = withTrait(makeComponent({ name: 'A', health: 10 }), { type: 'titanHardpoint' });
      const actor = makeCombinerActor([holder]);

      actor._prepareMegaformCombinerData();

      expect(actor.system.hasTitanHardpoint).toBe(true);
    });

    test("Skill Expertise adds a flat modifier to the chosen Skill", () => {
      const holder = withTrait(
        makeComponent({ name: 'A', health: 10 }), { type: 'skillExpertise', skill: 'athletics', value: 1 },
      );
      const actor = makeCombinerActor([holder]);

      actor._prepareMegaformCombinerData();

      expect(actor.system.skills.athletics.modifier).toBe(1);
    });
  });

  describe("Commander (Enigma of Combination, p.42)", () => {
    function withTrait(component, system) {
      component.items = [...component.items, { type: 'megaformTrait', system }];
      return component;
    }

    test("adds +1 to the two highest Essence Scores exactly once, even with multiple holders", () => {
      const holder1 = withTrait(makeComponent({ name: 'A', health: 10 }), { type: 'commander' });
      const holder2 = withTrait(makeComponent({ name: 'B', health: 10 }), { type: 'commander' });
      const actor = makeCombinerActor([holder1, holder2]);

      actor._prepareMegaformCombinerData();

      // makeComponent defaults: Strength 3, Speed/Smarts/Social 2 each - Strength is the clear
      // highest, Speed wins the 3-way tie for second via the fixed Strength>Speed>Smarts>Social
      // tie-break order below. Both holders taking Commander still only applies the +1 once.
      expect(actor.system.essences.strength.value).toBe(4);
      expect(actor.system.essences.speed.value).toBe(3);
      expect(actor.system.essences.smarts.value).toBe(2);
      expect(actor.system.essences.social.value).toBe(2);
    });

    test("breaks a tie for second place using the fixed Strength > Speed > Smarts > Social order", () => {
      const holder = makeComponent({ name: 'A', health: 10 });
      holder.system.essences.strength.value = 5;
      holder.system.essences.speed.value = 3;
      holder.system.essences.smarts.value = 3;
      holder.system.essences.social.value = 1;
      withTrait(holder, { type: 'commander' });
      const actor = makeCombinerActor([holder]);

      actor._prepareMegaformCombinerData();

      expect(actor.system.essences.strength.value).toBe(6);
      expect(actor.system.essences.speed.value).toBe(4);
      expect(actor.system.essences.smarts.value).toBe(3);
      expect(actor.system.essences.social.value).toBe(1);
    });
  });

  test("Stun is summed fresh from every participant's own current value, not pooled", () => {
    const a = makeComponent({ name: 'A', health: 10, stun: 1 });
    const b = makeComponent({ name: 'B', health: 10, stun: 4 });
    const actor = makeCombinerActor([a, b]);

    actor._prepareMegaformCombinerData();

    expect(actor.system.stun.value).toBe(5);
  });

  test("also lists each participant's own current Stun individually, for the sidebar's per-member display", () => {
    const a = makeComponent({ name: 'A', health: 10, stun: 1 });
    const b = makeComponent({ name: 'B', health: 10, stun: 4 });
    const actor = makeCombinerActor([a, b]);

    actor._prepareMegaformCombinerData();

    expect(actor.system.participantStun).toEqual([
      { name: 'A', value: 1 },
      { name: 'B', value: 4 },
    ]);
  });
});

describe("_prepareVehicleData", () => {
  function makeVehicleActor({ crashed = false, crew = {}, numDrivers = 1, traits = {} } = {}) {
    return makeActor('vehicle', {
      crashed,
      movementIsReadOnly: false,
      movement: {
        ground: { total: 30, base: 30 },
        aerial: { total: 0, base: 0 },
      },
      crew: { numDrivers, numPassengers: 0 },
      actors: crew,
      traits,
    });
  }

  function makeDriverEntry(uuid) {
    return { vehicleRole: 'driver', uuid };
  }

  function makeDriver({ shift = 'd2' } = {}) {
    return { system: { skills: { driving: { shift } } } };
  }

  beforeEach(() => {
    global.fromUuidSync.mockReset();
  });

  test("leaves Movement alone when not crashed and fully staffed with qualified drivers", () => {
    global.fromUuidSync.mockReturnValue(makeDriver());
    const actor = makeVehicleActor({ crew: { c1: makeDriverEntry('Actor.d1') } });

    actor._prepareVehicleData();

    expect(actor.system.movement.ground.total).toBe(30);
    expect(actor.system.movementIsReadOnly).toBe(false);
  });

  test("zeroes every Movement type's displayed total and makes it read-only while crashed", () => {
    const actor = makeVehicleActor({ crashed: true, crew: { c1: makeDriverEntry('Actor.d1') } });

    actor._prepareVehicleData();

    expect(actor.system.movement.ground.total).toBe(0);
    expect(actor.system.movement.aerial.total).toBe(0);
    expect(actor.system.movementIsReadOnly).toBe(true);
    // The real stored value underneath is untouched - only the derived .total is overridden.
    expect(actor.system.movement.ground.base).toBe(30);
  });

  describe("Crew (GI Joe CRB, p.212) - driver-count Movement penalty", () => {
    test("halves every Movement type when fewer drivers are seated than the vehicle needs", () => {
      global.fromUuidSync.mockReturnValue(makeDriver());
      const actor = makeVehicleActor({ numDrivers: 2, crew: { c1: makeDriverEntry('Actor.d1') } });

      actor._prepareVehicleData();

      expect(actor.system.movement.ground.total).toBe(15);
    });

    test("halves every Movement type when the seated driver isn't trained (below d2 in Driving)", () => {
      global.fromUuidSync.mockReturnValue(makeDriver({ shift: 'd20' }));
      const actor = makeVehicleActor({ crew: { c1: makeDriverEntry('Actor.d1') } });

      actor._prepareVehicleData();

      expect(actor.system.movement.ground.total).toBe(15);
    });

    test("doesn't penalize a vehicle that needs no drivers at all", () => {
      const actor = makeVehicleActor({ numDrivers: 0, crew: {} });

      actor._prepareVehicleData();

      expect(actor.system.movement.ground.total).toBe(30);
    });

    test("a non-driver crew member (e.g. a gunner) doesn't count toward the driver requirement", () => {
      global.fromUuidSync.mockReturnValue(makeDriver());
      const actor = makeVehicleActor({ crew: { c1: { vehicleRole: 'gunner', uuid: 'Actor.g1' } } });

      actor._prepareVehicleData();

      expect(actor.system.movement.ground.total).toBe(15);
    });

    describe("Autopilot (GI Joe CRB, Vehicle Trait, p.173)", () => {
      test("operates at full capacity with just 1 driver, even understaffed", () => {
        global.fromUuidSync.mockReturnValue(makeDriver());
        const actor = makeVehicleActor({
          numDrivers: 2, crew: { c1: makeDriverEntry('Actor.d1') }, traits: { autopilot: true },
        });

        actor._prepareVehicleData();

        expect(actor.system.movement.ground.total).toBe(30);
      });

      test("doesn't help with 0 qualified drivers - still halved, same as Advanced Autopilot's own guarantee", () => {
        const actor = makeVehicleActor({ crew: {}, traits: { autopilot: true } });

        actor._prepareVehicleData();

        expect(actor.system.movement.ground.total).toBe(15);
      });

      test("doesn't apply without the trait", () => {
        global.fromUuidSync.mockReturnValue(makeDriver());
        const actor = makeVehicleActor({ numDrivers: 2, crew: { c1: makeDriverEntry('Actor.d1') } });

        actor._prepareVehicleData();

        expect(actor.system.movement.ground.total).toBe(15);
      });
    });
  });
});

describe("_prepareActions", () => {
  /**
   * An actor carrying the shared system.actions block plus a Speed Essence, which is what the
   * rules actually derive the budget from (GI Joe CRB p.192-193).
   */
  function actionsActor({ statuses = [], bonus = {}, speed = 2 } = {}) {
    const budget = (category) => ({ base: 0, bonus: bonus[category] ?? 0, max: 0 });
    const actor = makeActor("playerCharacter", {
      essences: { speed: { value: speed, max: speed }, smarts: { value: 0, max: 0 } },
      actions: {
        enabled: true,
        shared: false,
        free: budget("free"),
        move: budget("move"),
        standard: budget("standard"),
      },
    });
    actor.statuses = new Set(statuses);
    return actor;
  }

  // The three budget shapes the rules define, by Speed Essence.
  test("Speed 1 gets one Move and one Standard, flagged as a shared single action", () => {
    const actor = actionsActor({ speed: 1 });
    actor._prepareActions();

    expect(actor.system.actions.shared).toBe(true);
    expect(actor.system.actions.standard.max).toBe(1);
    expect(actor.system.actions.move.max).toBe(1);
    expect(actor.system.actions.free.max).toBe(0);
  });

  test("Speed 2 gets a Move and a Standard and no Free actions", () => {
    const actor = actionsActor({ speed: 2 });
    actor._prepareActions();

    expect(actor.system.actions.shared).toBe(false);
    expect(actor.system.actions.free.max).toBe(0);
  });

  test.each([[3, 1], [4, 2], [5, 3]])("Speed %i grants %i Free actions", (speed, expected) => {
    const actor = actionsActor({ speed });
    actor._prepareActions();

    expect(actor.system.actions.free.max).toBe(expected);
  });

  test("an actor type with no Essences falls back to the ordinary Speed 2 turn", () => {
    const actor = makeActor("vehicle", {
      actions: {
        enabled: true, shared: false,
        free: { base: 0, bonus: 0, max: 0 },
        move: { base: 0, bonus: 0, max: 0 },
        standard: { base: 0, bonus: 0, max: 0 },
      },
    });
    actor.statuses = new Set();
    actor._prepareActions();

    expect(actor.system.actions.standard.max).toBe(1);
    expect(actor.system.actions.move.max).toBe(1);
    expect(actor.system.actions.free.max).toBe(0);
    expect(actor.system.actions.shared).toBe(false);
  });

  // "You gain an additional Standard action each turn" (CRB p.81) is a plain Active Effect on
  // .bonus, which is the whole reason base and bonus are separate fields.
  test("an Active Effect bonus adds on top of the Speed-derived base", () => {
    const actor = actionsActor({ speed: 4, bonus: { standard: 1, free: 1 } });
    actor._prepareActions();

    expect(actor.system.actions.standard.max).toBe(2);
    expect(actor.system.actions.free.max).toBe(3);
  });

  test("a negative bonus can not push a budget below zero", () => {
    const actor = actionsActor({ bonus: { standard: -5 } });
    actor._prepareActions();

    expect(actor.system.actions.standard.max).toBe(0);
  });

  // The two Conditions below have existed in E20.statusEffects since the MLP CRB
  // Laughtracting/Distraughter Perks were built, doing nothing at all because there was no action
  // economy to gate against. These are the tests that they now do something.
  test("cantTakeFreeActions clamps Free actions to zero, leaving the rest alone", () => {
    const actor = actionsActor({ speed: 4, statuses: ["cantTakeFreeActions"] });
    actor._prepareActions();

    expect(actor.system.actions.free.max).toBe(0);
    expect(actor.system.actions.standard.max).toBe(1);
    expect(actor.system.actions.move.max).toBe(1);
  });

  test("cantTakeMoveActions clamps the Move action only", () => {
    const actor = actionsActor({ speed: 4, statuses: ["cantTakeMoveActions"] });
    actor._prepareActions();

    expect(actor.system.actions.move.max).toBe(0);
    expect(actor.system.actions.standard.max).toBe(1);
    expect(actor.system.actions.free.max).toBe(2);
  });

  test.each(["asleep", "defeated", "unconscious"])("%s zeroes every budget", (status) => {
    const actor = actionsActor({ speed: 5, statuses: [status] });
    actor._prepareActions();

    expect(actor.system.actions.standard.max).toBe(0);
    expect(actor.system.actions.move.max).toBe(0);
    expect(actor.system.actions.free.max).toBe(0);
  });

  // Immobilized/Grappled/Restrained restrict movement DISTANCE rather than denying the Move action
  // itself - inventing a rule for them is not this method job, so they deliberately do nothing.
  test.each(["grappled", "immobilized", "restrained"])("%s leaves the Move action alone", (status) => {
    const actor = actionsActor({ statuses: [status] });
    actor._prepareActions();

    expect(actor.system.actions.move.max).toBe(1);
  });

  test("an actor type without an actions block is left untouched", () => {
    const actor = makeActor("vehicle", {});
    expect(() => actor._prepareActions()).not.toThrow();
  });
});

describe("_prepareActions agrees with getNumActions", () => {
  /* The budget used to be derived here a second time, independently of helpers/actor.mjs#
     getNumActions - the helper that already drove the sheet's own "1M, 1S, 1F" readout. The two
     silently disagreed whenever Speed's .max and .value differed, so the sheet showed one number
     beside a different set of pips. Live testing caught it; these pin the agreement. */
  function essenceActor({ speedMax, speedValue, smarts = 0 }) {
    const actor = makeActor('playerCharacter', {
      essences: {
        speed: { max: speedMax, value: speedValue },
        smarts: { max: smarts, value: smarts },
      },
      actions: {
        enabled: true, shared: false,
        free: { base: 0, bonus: 0, max: 0 },
        move: { base: 0, bonus: 0, max: 0 },
        standard: { base: 0, bonus: 0, max: 0 },
      },
    });
    actor.statuses = new Set();
    return actor;
  }

  test("uses Speed's max rather than its current value", () => {
    const actor = essenceActor({ speedMax: 5, speedValue: 2 });
    actor._prepareActions();

    // getNumActions reads .max ?? .value, so a drained Speed still budgets from the maximum.
    expect(actor.system.actions.free.max).toBe(3);
  });

  test("Speed 1 grants both actions and marks them shared", () => {
    const actor = essenceActor({ speedMax: 1, speedValue: 1 });
    actor._prepareActions();

    // getNumActions reports standard 0 here; the rules say "Move OR Standard", so both are
    // granted and `shared` makes them mutually exclusive.
    expect(actor.system.actions.shared).toBe(true);
    expect(actor.system.actions.standard.max).toBe(1);
    expect(actor.system.actions.move.max).toBe(1);
  });
});


describe("_prepareLoadout", () => {
  function loadoutSystem(overrides = {}) {
    return {
      loadout: { handsMax: 6 },
      hardpoints: {
        external: { base: 2, bonus: 0 },
        integrated: { base: 2, bonus: 0 },
      },
      ...overrides,
    };
  }

  function weapon(system) {
    return { type: 'weapon', system: { equipped: true, hardpoint: { type: 'external' }, ...system } };
  }

  test("bails out when the actor has no loadout/hardpoints schema", () => {
    const actor = makeActor('playerCharacter', {});
    expect(() => actor._prepareLoadout()).not.toThrow();
  });

  test("sums equipped external weapon hands into loadout.handsUsed", () => {
    const actor = makeActor('playerCharacter', loadoutSystem(), {
      weapon: [
        weapon({ derivedHands: 2 }),
        weapon({ derivedHands: 1 }),
        weapon({ derivedHands: 1 }),
      ],
    });
    actor._prepareLoadout();
    expect(actor.system.loadout.handsUsed).toBe(4);
    expect(actor.system.loadout.handsOver).toBe(false);
  });

  test("flags handsOver once the six-hand limit is exceeded", () => {
    const actor = makeActor('playerCharacter', loadoutSystem(), {
      weapon: [weapon({ derivedHands: 4 }), weapon({ derivedHands: 3 })],
    });
    actor._prepareLoadout();
    expect(actor.system.loadout.handsUsed).toBe(7);
    expect(actor.system.loadout.handsOver).toBe(true);
  });

  test("ignores unequipped and non-weapon items", () => {
    const actor = makeActor('playerCharacter', loadoutSystem(), {
      weapon: [weapon({ derivedHands: 2, equipped: false }), weapon({ derivedHands: 1 })],
    });
    actor._prepareLoadout();
    expect(actor.system.loadout.handsUsed).toBe(1);
  });

  test("integrated-Hardpoint weapons don't count against the six-hand limit", () => {
    const actor = makeActor('playerCharacter', loadoutSystem(), {
      weapon: [
        weapon({ derivedHands: 2, hardpoint: { type: 'integrated' } }),
        weapon({ derivedHands: 1 }),
      ],
    });
    actor._prepareLoadout();
    expect(actor.system.loadout.handsUsed).toBe(1);
    expect(actor.system.hardpoints.integrated.used).toBe(2);
    expect(actor.system.hardpoints.external.used).toBe(1);
  });

  test("a two-handed integrated weapon uses two Integrated Hardpoint slots", () => {
    const actor = makeActor('playerCharacter', loadoutSystem(), {
      weapon: [weapon({ derivedHands: 2, hardpoint: { type: 'integrated' } })],
    });
    actor._prepareLoadout();
    expect(actor.system.hardpoints.integrated.used).toBe(2);
    expect(actor.system.hardpoints.integrated.max).toBe(2);
    expect(actor.system.hardpoints.integrated.over).toBe(false);
  });

  test("a one-handed integrated weapon still occupies one slot", () => {
    const actor = makeActor('playerCharacter', loadoutSystem(), {
      weapon: [weapon({ derivedHands: 0, hardpoint: { type: 'integrated' } })],
    });
    actor._prepareLoadout();
    expect(actor.system.hardpoints.integrated.used).toBe(1);
  });

  test("hardpoint max folds in the bonus and flags over", () => {
    const actor = makeActor('playerCharacter', loadoutSystem({
      hardpoints: {
        external: { base: 2, bonus: 1 },
        integrated: { base: 2, bonus: 0 },
      },
    }), {
      weapon: [
        weapon({ derivedHands: 1 }),
        weapon({ derivedHands: 1 }),
        weapon({ derivedHands: 1 }),
        weapon({ derivedHands: 1 }),
      ],
    });
    actor._prepareLoadout();
    expect(actor.system.hardpoints.external.max).toBe(3);
    expect(actor.system.hardpoints.external.used).toBe(4);
    expect(actor.system.hardpoints.external.over).toBe(true);
  });

  test("a weapon set to no Hardpoint still counts against the six-hand limit", () => {
    const actor = makeActor('playerCharacter', loadoutSystem(), {
      weapon: [weapon({ derivedHands: 3, hardpoint: { type: 'none' } })],
    });
    actor._prepareLoadout();
    expect(actor.system.loadout.handsUsed).toBe(3);
    expect(actor.system.hardpoints.external.used).toBe(0);
  });
});

describe("_preparePartyData", () => {
  function partySystem(overrides = {}) {
    return {
      actors: {},
      requisition: { attempts: 0, autoFromRoster: true, log: [] },
      ...overrides,
    };
  }

  const realFromUuidSync = global.fromUuidSync;
  afterEach(() => {
    global.fromUuidSync = realFromUuidSync;
  });

  test("counts only Player Character roster entries and derives requisitionMax = 3 x count", () => {
    global.fromUuidSync = jest.fn((uuid) => ({
      'Actor.pc1': { type: 'playerCharacter' },
      'Actor.pc2': { type: 'playerCharacter' },
      'Actor.npc1': { type: 'npc' },
    }[uuid]));

    const actor = makeActor('party', partySystem({
      actors: {
        a: { uuid: 'Actor.pc1' },
        b: { uuid: 'Actor.pc2' },
        c: { uuid: 'Actor.npc1' },
        d: { uuid: 'Actor.gone' },
      },
    }));
    actor._preparePartyData();

    expect(actor.system.memberCount).toBe(2);
    expect(actor.system.requisitionMax).toBe(6);
  });

  // Regression: this used to be called from the tail of _prepareVehicleData(), which
  // prepareDerivedData() only runs for a vehicle - so on a Party it never ran, and every Party
  // reported 0 members and a 0 Requisition pool. The direct-call tests here could not see that,
  // so this one goes in through prepareDerivedData().
  test("prepareDerivedData reaches it for a Party", () => {
    global.fromUuidSync = jest.fn(() => ({ type: 'playerCharacter' }));
    const actor = makeActor('party', partySystem({ actors: { a: { uuid: 'Actor.pc1' } } }));

    actor.prepareDerivedData();

    expect(actor.system.memberCount).toBe(1);
    expect(actor.system.requisitionMax).toBe(3);
  });

  test("an empty roster yields 0 members and a 0 pool", () => {
    global.fromUuidSync = jest.fn(() => null);
    const actor = makeActor('party', partySystem());
    actor._preparePartyData();

    expect(actor.system.memberCount).toBe(0);
    expect(actor.system.requisitionMax).toBe(0);
  });

  test("when autoFromRoster is off, requisitionMax mirrors the manual attempts value", () => {
    global.fromUuidSync = jest.fn(() => ({ type: 'playerCharacter' }));
    const actor = makeActor('party', partySystem({
      actors: { a: { uuid: 'Actor.pc1' } },
      requisition: { attempts: 9, autoFromRoster: false, log: [] },
    }));
    actor._preparePartyData();

    expect(actor.system.memberCount).toBe(1);
    expect(actor.system.requisitionMax).toBe(9);
  });
});

describe("Party member roster", () => {
  const realFromUuidSync = global.fromUuidSync;
  afterEach(() => {
    global.fromUuidSync = realFromUuidSync;
  });

  function makeParty(actors = {}) {
    const p = makeActor('party', { actors });
    p.update = jest.fn(async () => {});
    return p;
  }

  describe("get members", () => {
    test("resolves system.actors to live Player Character actors, dropping non-PC and unresolved entries", () => {
      global.fromUuidSync = jest.fn(uuid => ({
        'Actor.pc1': { type: 'playerCharacter', name: 'Duke' },
        'Actor.pc2': { type: 'playerCharacter', name: 'Scarlett' },
        'Actor.npc1': { type: 'npc' },
      }[uuid] ?? null));

      const party = makeParty({
        a: { uuid: 'Actor.pc1' },
        b: { uuid: 'Actor.npc1' },
        c: { uuid: 'Actor.pc2' },
        d: { uuid: 'Actor.gone' },
      });

      expect(party.members.map(m => m.name)).toEqual(['Duke', 'Scarlett']);
    });

    test("is empty for a non-Party actor", () => {
      const npc = makeActor('npc', { actors: { a: { uuid: 'Actor.pc1' } } });
      expect(npc.members).toEqual([]);
    });
  });

  describe("addMember", () => {
    test("writes a new system.actors entry for a Player Character", async () => {
      const party = makeParty();
      await party.addMember({ type: 'playerCharacter', uuid: 'Actor.pc1', img: 'a.png', name: 'Duke' });

      expect(party.update).toHaveBeenCalledTimes(1);
      const update = party.update.mock.calls[0][0];
      const [path, entry] = Object.entries(update)[0];
      expect(path).toMatch(/^system\.actors\.[A-Za-z0-9]+$/);
      expect(entry).toEqual({ uuid: 'Actor.pc1', img: 'a.png', name: 'Duke', type: 'playerCharacter' });
    });

    test("no-ops when the actor is already on the roster", async () => {
      const party = makeParty({ a: { uuid: 'Actor.pc1' } });
      await party.addMember({ type: 'playerCharacter', uuid: 'Actor.pc1', name: 'Duke' });
      expect(party.update).not.toHaveBeenCalled();
    });

    test("no-ops for a non-Player-Character actor", async () => {
      const party = makeParty();
      await party.addMember({ type: 'npc', uuid: 'Actor.npc1' });
      expect(party.update).not.toHaveBeenCalled();
    });

    test("no-ops on a non-Party actor", async () => {
      const npc = makeActor('npc', { actors: {} });
      npc.update = jest.fn();
      await npc.addMember({ type: 'playerCharacter', uuid: 'Actor.pc1' });
      expect(npc.update).not.toHaveBeenCalled();
    });
  });

  describe("removeMember", () => {
    test("removes the roster entry matching the given UUID", async () => {
      const party = makeParty({ a: { uuid: 'Actor.pc1' }, b: { uuid: 'Actor.pc2' } });
      await party.removeMember('Actor.pc2');
      expect(party.update).toHaveBeenCalledWith({ 'system.actors.-=b': null });
    });

    test("no-ops when the UUID isn't on the roster", async () => {
      const party = makeParty({ a: { uuid: 'Actor.pc1' } });
      await party.removeMember('Actor.nope');
      expect(party.update).not.toHaveBeenCalled();
    });
  });
});

describe("Zord creation adds its two standard Features", () => {
  const CALL_TO_ACTION_ID = "Compendium.essence20.pr_crb.Item.yjhd6FRLJOsOQqN4";
  const RECALL_FOR_REPAIRS_ID = "Compendium.essence20.pr_crb.Item.r1S0Sc4oq8axDL6C";
  const sources = {
    [CALL_TO_ACTION_ID]: { name: "Call to Action", type: "feature" },
    [RECALL_FOR_REPAIRS_ID]: { name: "Recall For Repairs", type: "feature" },
  };

  /** A Zord about to be created, already carrying `items` - as a duplicate or import would. */
  function makeNewZord(items) {
    const actor = new Essence20Actor();
    actor.type = 'zord';
    actor.items = items;
    actor._source = { items: items.map(item => ({ ...item })) };
    actor.updateSource = jest.fn();
    return actor;
  }

  beforeEach(() => {
    global.fromUuid.mockImplementation(async uuid => sources[uuid] ?? null);
    global.game.items = { fromCompendium: jest.fn(source => ({ ...source, _stats: { compendiumSource: 'x' } })) };
  });

  afterEach(() => {
    global.fromUuid.mockReset();
    delete global.game.items;
  });

  test("a new Zord gets both", async () => {
    const actor = makeNewZord([]);
    await actor._preCreate({}, {}, {});

    const added = actor.updateSource.mock.calls[0][0].items.map(item => item.name);
    expect(added).toEqual(["Call to Action", "Recall For Repairs"]);
  });

  test("a duplicated Zord that already has both gets neither again", async () => {
    const actor = makeNewZord([
      { type: 'feature', name: "Call to Action", _stats: { compendiumSource: CALL_TO_ACTION_ID } },
      { type: 'feature', name: "Recall For Repairs", _stats: { compendiumSource: RECALL_FOR_REPAIRS_ID } },
    ]);
    await actor._preCreate({}, {}, {});

    expect(actor.updateSource).not.toHaveBeenCalled();
  });

  // A copy made outside Foundry's own duplicate can lose the compendium link, but not the name.
  test("an existing Feature is recognised by name when its source link is gone", async () => {
    const actor = makeNewZord([
      { type: 'feature', name: "Call to Action" },
      { type: 'feature', name: "Recall For Repairs" },
    ]);
    await actor._preCreate({}, {}, {});

    expect(actor.updateSource).not.toHaveBeenCalled();
  });

  test("only the missing one is added, and the Zord keeps its own items", async () => {
    const weapon = { type: 'weapon', name: "Zord Cannon" };
    const actor = makeNewZord([
      weapon,
      { type: 'feature', name: "Call to Action", _stats: { compendiumSource: CALL_TO_ACTION_ID } },
    ]);
    await actor._preCreate({}, {}, {});

    const items = actor.updateSource.mock.calls[0][0].items.map(item => item.name);
    expect(items).toEqual(["Zord Cannon", "Call to Action", "Recall For Repairs"]);
  });
});
