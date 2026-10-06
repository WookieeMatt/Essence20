import { jest } from '@jest/globals';
import {
  getDefenseValue, getVehicleDriver, getOwnedZord, computeMultiplier, getEffectiveLevel, applyDamage,
  healStunAtTurnStart, _isCritIsFumble, getSecondaryDamage, rechargeLifeSupporting, toughEnoughDamage,
  getSecondaryDamageForButton,
} from './combat.mjs';

describe("getDefenseValue", () => {
  test("prefers .total (Player Character/Companion, computed by _prepareDefenses)", () => {
    const actor = { system: { defenses: { toughness: { total: 15, value: 99 } } } };
    expect(getDefenseValue(actor, 'toughness')).toBe(15);
  });

  test("falls back to .value (NPC/Vehicle/Zord/Megaform, stored directly)", () => {
    const actor = { system: { defenses: { toughness: { value: 12 } } } };
    expect(getDefenseValue(actor, 'toughness')).toBe(12);
  });

  test("returns 0 when the actor has no defenses data at all", () => {
    const actor = { system: {} };
    expect(getDefenseValue(actor, 'toughness')).toBe(0);
  });

  test("ignoreArmor subtracts the armor component out of .total (PR 'Driving Strike')", () => {
    const actor = { system: { isMorphed: false, defenses: { toughness: { total: 15, armor: 4 } } } };
    expect(getDefenseValue(actor, 'toughness', { ignoreArmor: true })).toBe(11);
    expect(getDefenseValue(actor, 'toughness')).toBe(15); // unaffected without the option
  });

  test("ignoreArmor subtracts the morphed component instead, while Morphed", () => {
    const actor = { system: { isMorphed: true, defenses: { toughness: { total: 17, armor: 4, morphed: 6 } } } };
    expect(getDefenseValue(actor, 'toughness', { ignoreArmor: true })).toBe(11);
  });

  test("ignoreArmor has no effect on an NPC/Vehicle/Zord's flat .value (no armor breakdown to subtract)", () => {
    const actor = { system: { defenses: { toughness: { value: 12 } } } };
    expect(getDefenseValue(actor, 'toughness', { ignoreArmor: true })).toBe(12);
  });

  describe("'armorStripped' status (Ice Flechettes) forces ignoreArmor on, target-side", () => {
    test("subtracts the armor component even with no ignoreArmor option passed", () => {
      const actor = {
        system: { isMorphed: false, defenses: { toughness: { total: 15, armor: 4 } } },
        statuses: new Set(['armorStripped']),
      };
      expect(getDefenseValue(actor, 'toughness')).toBe(11);
    });

    test("has no effect without the status", () => {
      const actor = {
        system: { isMorphed: false, defenses: { toughness: { total: 15, armor: 4 } } },
        statuses: new Set(),
      };
      expect(getDefenseValue(actor, 'toughness')).toBe(15);
    });
  });

  describe("ignoreArmorPoints (Decepticon Directive Raider 'Penetrating Aim')", () => {
    test("subtracts only the given number of points, not the whole armor component", () => {
      const actor = { system: { isMorphed: false, defenses: { toughness: { total: 15, armor: 4 } } } };
      expect(getDefenseValue(actor, 'toughness', { ignoreArmorPoints: 1 })).toBe(14);
      expect(getDefenseValue(actor, 'toughness')).toBe(15); // unaffected without the option
    });

    test("caps at the actual armor component - never goes negative", () => {
      const actor = { system: { isMorphed: false, defenses: { toughness: { total: 15, armor: 2 } } } };
      expect(getDefenseValue(actor, 'toughness', { ignoreArmorPoints: 5 })).toBe(13);
    });

    test("subtracts from the morphed component instead, while Morphed", () => {
      const actor = { system: { isMorphed: true, defenses: { toughness: { total: 17, armor: 4, morphed: 6 } } } };
      expect(getDefenseValue(actor, 'toughness', { ignoreArmorPoints: 1 })).toBe(16);
    });

    test("has no effect on an NPC/Vehicle/Zord's flat .value", () => {
      const actor = { system: { defenses: { toughness: { value: 12 } } } };
      expect(getDefenseValue(actor, 'toughness', { ignoreArmorPoints: 1 })).toBe(12);
    });

    test("ignoreArmor (the full strip) wins if both are somehow set at once", () => {
      const actor = { system: { isMorphed: false, defenses: { toughness: { total: 15, armor: 4 } } } };
      expect(getDefenseValue(actor, 'toughness', { ignoreArmor: true, ignoreArmorPoints: 1 })).toBe(11);
    });

    test("0 (the default) has no effect", () => {
      const actor = { system: { isMorphed: false, defenses: { toughness: { total: 15, armor: 4 } } } };
      expect(getDefenseValue(actor, 'toughness', { ignoreArmorPoints: 0 })).toBe(15);
    });
  });

  describe("ignoreShield (Cobra Codex Screwball/Arched Weapon Upgrades' Bypassing trait)", () => {
    test("subtracts the shield component out of .total", () => {
      const actor = { system: { defenses: { toughness: { total: 15, shield: 2 } } } };
      expect(getDefenseValue(actor, 'toughness', { ignoreShield: true })).toBe(13);
      expect(getDefenseValue(actor, 'toughness')).toBe(15); // unaffected without the option
    });

    test("has no effect on an NPC/Vehicle/Zord's flat .value", () => {
      const actor = { system: { defenses: { toughness: { value: 12 } } } };
      expect(getDefenseValue(actor, 'toughness', { ignoreShield: true })).toBe(12);
    });

    test("false (the default) has no effect", () => {
      const actor = { system: { defenses: { toughness: { total: 15, shield: 2 } } } };
      expect(getDefenseValue(actor, 'toughness')).toBe(15);
    });
  });

  describe("Vehicle/Zord Willpower/Cleverness driver/pilot substitution (GI Joe CRB p.173, PR CRB p.126/136)", () => {
    const RELIC_KEY_ID = "Compendium.essence20.pr_crb.Item.uSlClAv3oJjf54pa";
    const ZORD_SENTIENCE_ID = "Compendium.essence20.beneath_the_helmet.Item.idhVrfBIKELsl3OW";

    function makeZord({
      driverUuid = null, hasRelicKey = false, hasZordSentience = false, base = null, bonus = 0, armor = 0, shield = 0,
    } = {}) {
      const features = [];
      if (hasRelicKey) {
        features.push({ type: 'feature', flags: { core: { sourceId: RELIC_KEY_ID } } });
      }

      if (hasZordSentience) {
        features.push({ type: 'feature', flags: { core: { sourceId: ZORD_SENTIENCE_ID } } });
      }

      return {
        type: 'zord',
        items: features,
        system: {
          actors: driverUuid ? { a: { uuid: driverUuid, vehicleRole: 'driver' } } : {},
          defenses: { willpower: { usesDrivers: true, base, bonus, armor, shield, total: 0 } },
        },
      };
    }

    function makeVehicle({ driverUuid = null, ai = false } = {}) {
      return {
        type: 'vehicle',
        system: {
          actors: driverUuid ? { a: { uuid: driverUuid, vehicleRole: 'driver' } } : {},
          traits: { ai },
          defenses: { willpower: { usesDrivers: true, total: 12 } },
        },
      };
    }

    beforeEach(() => {
      global.fromUuidSync.mockReset();
    });

    test("redirects to the current driver's own computed Willpower when one is seated", () => {
      const zord = makeZord({ driverUuid: 'Actor.driver1' });
      const driver = { system: { defenses: { willpower: { total: 17 } } } };
      global.fromUuidSync.mockReturnValue(driver);

      expect(getDefenseValue(zord, 'willpower')).toBe(17);
    });

    test("Relic Key defaults to a Smarts/Social of 3 when unpiloted", () => {
      const zord = makeZord({ hasRelicKey: true, base: 10, bonus: 1, armor: 0, shield: 0 });

      // base(10) + 3 (Relic Key's own Smarts/Social default) + bonus(1) + armor(0) + shield(0)
      expect(getDefenseValue(zord, 'willpower')).toBe(14);
    });

    test("Zord Sentience defaults to a Smarts/Social of 2 when unpiloted", () => {
      const zord = makeZord({ hasZordSentience: true, base: 10, bonus: 1, armor: 0, shield: 0 });

      // base(10) + 2 (Zord Sentience's own Smarts/Social default) + bonus(1) + armor(0) + shield(0)
      expect(getDefenseValue(zord, 'willpower')).toBe(13);
    });

    test("returns an effectively-unbeatable value with no driver and no Relic Key", () => {
      const zord = makeZord();
      expect(getDefenseValue(zord, 'willpower')).toBe(Infinity);
    });

    test("an A.I.-trait Vehicle computes its own value instead of redirecting, even with a driver seated", () => {
      const vehicle = makeVehicle({ driverUuid: 'Actor.driver1', ai: true });
      global.fromUuidSync.mockReturnValue({ system: { defenses: { willpower: { total: 5 } } } });

      expect(getDefenseValue(vehicle, 'willpower')).toBe(12);
    });

    test("a non-A.I. Vehicle still redirects to its driver", () => {
      const vehicle = makeVehicle({ driverUuid: 'Actor.driver1' });
      global.fromUuidSync.mockReturnValue({ system: { defenses: { willpower: { total: 9 } } } });

      expect(getDefenseValue(vehicle, 'willpower')).toBe(9);
    });

    test("Toughness/Evasion never redirect, even if usesDrivers were somehow set", () => {
      const zord = {
        type: 'zord',
        items: [],
        system: { actors: {}, defenses: { toughness: { total: 17 } } },
      };
      expect(getDefenseValue(zord, 'toughness')).toBe(17);
    });
  });

  describe("Responsive (GI Joe CRB, Vehicle Trait) - Evasion driver substitution", () => {
    function makeVehicle({ driverUuid = null, responsive = true } = {}) {
      return {
        type: 'vehicle',
        system: {
          actors: driverUuid ? { a: { uuid: driverUuid, vehicleRole: 'driver' } } : {},
          traits: { responsive },
          defenses: { evasion: { total: 8 } },
        },
      };
    }

    beforeEach(() => {
      global.fromUuidSync.mockReset();
    });

    test("uses the driver's own Evasion when one is seated", () => {
      const vehicle = makeVehicle({ driverUuid: 'Actor.driver1' });
      global.fromUuidSync.mockReturnValue({ system: { defenses: { evasion: { total: 15 } } } });

      expect(getDefenseValue(vehicle, 'evasion')).toBe(15);
    });

    test("falls back to the vehicle's own Evasion with no driver seated", () => {
      const vehicle = makeVehicle({ driverUuid: null });
      expect(getDefenseValue(vehicle, 'evasion')).toBe(8);
    });

    test("a non-Responsive vehicle computes its own Evasion, even with a driver seated", () => {
      const vehicle = makeVehicle({ driverUuid: 'Actor.driver1', responsive: false });
      global.fromUuidSync.mockReturnValue({ system: { defenses: { evasion: { total: 15 } } } });

      expect(getDefenseValue(vehicle, 'evasion')).toBe(8);
    });

    test("Toughness never redirects for a Responsive vehicle", () => {
      const vehicle = makeVehicle({ driverUuid: 'Actor.driver1' });
      vehicle.system.defenses.toughness = { total: 20 };
      global.fromUuidSync.mockReturnValue({ system: { defenses: { toughness: { total: 5 } } } });

      expect(getDefenseValue(vehicle, 'toughness')).toBe(20);
    });
  });
});

describe("getVehicleDriver", () => {
  beforeEach(() => {
    global.fromUuidSync.mockReset();
  });

  test("finds the crew member with vehicleRole 'driver'", () => {
    const driver = { name: 'Duke' };
    global.fromUuidSync.mockReturnValue(driver);
    const vehicle = { system: { actors: { a: { uuid: 'Actor.duke', vehicleRole: 'driver' } } } };

    expect(getVehicleDriver(vehicle)).toBe(driver);
  });

  test("returns null with no driver seated", () => {
    const vehicle = { system: { actors: { a: { uuid: 'Actor.gunner', vehicleRole: 'gunner' } } } };
    expect(getVehicleDriver(vehicle)).toBeNull();
  });

  test("returns null with no crew at all", () => {
    expect(getVehicleDriver({ system: { actors: {} } })).toBeNull();
    expect(getVehicleDriver({ system: {} })).toBeNull();
  });
});

describe("getOwnedZord", () => {
  beforeEach(() => {
    global.fromUuidSync.mockReset();
  });

  test("finds the entry with type 'zord' among the pilot's own system.actors", () => {
    const torozord = { name: 'Torozord' };
    global.fromUuidSync.mockReturnValue(torozord);
    const pilot = { system: { actors: { a: { uuid: 'Actor.torozord', type: 'zord' } } } };

    expect(getOwnedZord(pilot)).toBe(torozord);
  });

  test("skips non-Zord entries (e.g. a companion) and returns null", () => {
    const pilot = { system: { actors: { a: { uuid: 'Actor.rex', type: 'companion' } } } };
    expect(getOwnedZord(pilot)).toBeNull();
  });

  test("returns null with no registered actors at all", () => {
    expect(getOwnedZord({ system: { actors: {} } })).toBeNull();
    expect(getOwnedZord({ system: {} })).toBeNull();
  });
});

describe("computeMultiplier", () => {
  test("returns 0 on a miss (total below difficulty)", () => {
    expect(computeMultiplier(10, 15)).toBe(0);
  });

  test("returns 0 when difficulty is falsy (no target Difficulty set)", () => {
    expect(computeMultiplier(10, 0)).toBe(0);
  });

  test("returns 1 on a plain hit (below double the Difficulty)", () => {
    expect(computeMultiplier(15, 15)).toBe(1);
    expect(computeMultiplier(29, 15)).toBe(1);
  });

  test("returns 2 at exactly double the Difficulty (Degrees of Success, p.169)", () => {
    expect(computeMultiplier(30, 15)).toBe(2);
  });

  test("returns 3 at triple the Difficulty", () => {
    expect(computeMultiplier(45, 15)).toBe(3);
  });
});

describe("getEffectiveLevel", () => {
  test("reads a PC/Companion's system.level", () => {
    expect(getEffectiveLevel({ system: { level: 7 } })).toBe(7);
  });

  test("falls back to an NPC/Vehicle's system.threatLevel when there's no system.level", () => {
    expect(getEffectiveLevel({ system: { threatLevel: 12 } })).toBe(12);
  });

  test("prefers system.level over system.threatLevel if somehow both are set", () => {
    expect(getEffectiveLevel({ system: { level: 7, threatLevel: 12 } })).toBe(7);
  });

  test("falls back to 0 if neither field is set", () => {
    expect(getEffectiveLevel({ system: {} })).toBe(0);
  });

  test("an NPC or Vehicle uses its Threat Level over the template's default level", () => {
    expect(getEffectiveLevel({ type: 'npc', system: { level: 1, threatLevel: 6 } })).toBe(6);
    expect(getEffectiveLevel({ type: 'vehicle', system: { level: 1, threatLevel: 3 } })).toBe(3);
    // No Threat Level set yet: its level, as before.
    expect(getEffectiveLevel({ type: 'npc', system: { level: 4, threatLevel: 0 } })).toBe(4);
    // A PC never reads a Threat Level.
    expect(getEffectiveLevel({ type: 'playerCharacter', system: { level: 5, threatLevel: 9 } })).toBe(5);
  });
});

describe("applyDamage", () => {
  test("subtracts from Health for a normal damage type, floored at 0", () => {
    const actor = { system: { health: { value: 5 }, immunities: {} }, update: jest.fn() };
    return applyDamage(actor, 8, 'fire').then((applied) => {
      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
      expect(applied).toBe(5); // only 5 of the 8 damage could actually be applied
    });
  });

  test("adds to the separate Stun accumulator instead of reducing Health", async () => {
    const actor = {
      system: { health: { value: 10 }, stun: { value: 2 }, immunities: {} },
      update: jest.fn(),
      toggleStatusEffect: jest.fn(),
    };
    const applied = await applyDamage(actor, 3, 'stun');
    expect(actor.update).toHaveBeenCalledWith({ 'system.stun.value': 5 });
    expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.health.value': expect.anything() }));
    expect(applied).toBe(3);
  });

  test("Immunity to the damage type zeroes out the damage entirely", async () => {
    const actor = { system: { health: { value: 10 }, immunities: { fire: true } }, update: jest.fn() };
    const applied = await applyDamage(actor, 8, 'fire');
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
    expect(applied).toBe(0);
  });

  test("an Essence damage type takes from that Essence, not Health (mechanics/combat/essence-attack.mjs)", async () => {
    const actor = {
      name: 'Target', items: [], getFlag: jest.fn(),
      system: { health: { value: 10 }, immunities: {}, essences: { strength: { max: 3, value: 3 } } },
      update: jest.fn(),
    };
    const applied = await applyDamage(actor, 1, 'essenceStrength');
    expect(applied).toBe(1);
    expect(actor.update).toHaveBeenCalledWith({ 'system.essences.strength.value': 2 });
    expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.health.value': expect.anything() }));
  });

  describe("Stun (damage type) - auto-Defeat when total Stun reaches remaining Health", () => {
    function makeActor({ health = 10, stun = 0, immunities = {} } = {}) {
      return {
        system: { health: { value: health }, stun: { value: stun }, immunities },
        update: jest.fn(),
        toggleStatusEffect: jest.fn(),
      };
    }

    test("toggles Defeated when the new Stun total exactly reaches remaining Health", async () => {
      const actor = makeActor({ health: 5, stun: 3 });
      await applyDamage(actor, 2, 'stun'); // 3 + 2 = 5, matches Health

      expect(actor.update).toHaveBeenCalledWith({ 'system.stun.value': 5 });
      expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: true });
    });

    test("toggles Defeated when the new Stun total exceeds remaining Health", async () => {
      const actor = makeActor({ health: 5, stun: 3 });
      await applyDamage(actor, 10, 'stun');

      expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: true });
    });

    test("doesn't toggle Defeated while Stun stays below remaining Health", async () => {
      const actor = makeActor({ health: 10, stun: 2 });
      await applyDamage(actor, 3, 'stun'); // 2 + 3 = 5, below Health 10

      expect(actor.toggleStatusEffect).not.toHaveBeenCalledWith('defeated', expect.anything());
    });

    test("doesn't toggle anything when Immune to Stun (no actual Stun landed)", async () => {
      const actor = makeActor({ health: 1, stun: 1, immunities: { stun: true } });
      await applyDamage(actor, 5, 'stun');

      expect(actor.update).toHaveBeenCalledWith({ 'system.stun.value': 1 }); // unchanged (+0)
      expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    });
  });

  describe("Not On My Watch (Factions in Action Vol. 2, Oktober Guard General Perk, p.95) - reaction on a genuine Defeat transition", () => {
    const NOT_ON_MY_WATCH_ID = "Compendium.essence20.intercontinental_adventures.Item.xH3iQ0NcXp1eFO35";

    function makeDefeatedActor({ health, stun = 0, immunities = {}, alreadyDefeated = false } = {}) {
      const token = { document: { disposition: 1 }, center: {} };
      return {
        name: 'Fallen Ally',
        system: { health: { value: health }, stun: { value: stun }, immunities },
        statuses: new Set(alreadyDefeated ? ['defeated'] : []),
        update: jest.fn(),
        toggleStatusEffect: jest.fn(),
        getActiveTokens: jest.fn(() => [token]),
        __token: token,
      };
    }

    function placeHolderNearby(defeatedActor) {
      const holderActor = {
        name: 'Reactor',
        items: [{ type: 'perk', flags: { core: { sourceId: NOT_ON_MY_WATCH_ID } } }],
      };
      const holderToken = { actor: holderActor, document: { disposition: 1 }, center: {} };
      global.canvas.tokens.placeables = [defeatedActor.__token, holderToken];
    }

    let originalCanvas;
    beforeEach(() => {
      originalCanvas = global.canvas;
      global.canvas = {
        tokens: { placeables: [] },
        grid: { measurePath: jest.fn(() => ({ distance: 5 })) },
      };
      global.ChatMessage.create.mockClear();
    });
    afterEach(() => {
      global.canvas = originalCanvas;
    });

    test("prompts a nearby ally holding the Perk when ordinary damage defeats the target", async () => {
      const actor = makeDefeatedActor({ health: 5 });
      placeHolderNearby(actor);

      await applyDamage(actor, 10, 'sharp');

      expect(global.ChatMessage.create).toHaveBeenCalledTimes(1);
    });

    test("prompts a nearby ally holding the Perk when Stun defeats the target", async () => {
      const actor = makeDefeatedActor({ health: 5, stun: 3 });
      placeHolderNearby(actor);

      await applyDamage(actor, 2, 'stun'); // 3 + 2 = 5, matches Health

      expect(global.ChatMessage.create).toHaveBeenCalledTimes(1);
    });

    test("doesn't prompt again for damage against an actor who was already Defeated", async () => {
      const actor = makeDefeatedActor({ health: 0, alreadyDefeated: true });
      placeHolderNearby(actor);

      await applyDamage(actor, 3, 'sharp');

      expect(global.ChatMessage.create).not.toHaveBeenCalled();
    });

    test("doesn't prompt when the hit doesn't actually defeat the target", async () => {
      const actor = makeDefeatedActor({ health: 10 });
      placeHolderNearby(actor);

      await applyDamage(actor, 3, 'sharp');

      expect(global.ChatMessage.create).not.toHaveBeenCalled();
    });
  });

  describe("Stun (damage type) - Move-action-denial marker (cantTakeMoveActions)", () => {
    function makeActor({ health = 10, stun = 0, immunities = {} } = {}) {
      return {
        system: { health: { value: health }, stun: { value: stun }, immunities },
        update: jest.fn(),
        toggleStatusEffect: jest.fn(),
      };
    }

    test("marks the target once any Stun actually lands", async () => {
      const actor = makeActor({ health: 10, stun: 0 });
      await applyDamage(actor, 2, 'stun');

      expect(actor.toggleStatusEffect).toHaveBeenCalledWith('cantTakeMoveActions', { active: true });
    });

    test("doesn't mark the target when Immune (no Stun actually landed)", async () => {
      const actor = makeActor({ health: 10, stun: 0, immunities: { stun: true } });
      await applyDamage(actor, 2, 'stun');

      expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    });
  });

  describe("Impenetrable Shield (Vanguard base, 18th level) - EMP immunity while active", () => {
    const IMPENETRABLE_SHIELD_ID = "Compendium.essence20.gi_joe_crb.Item.eEUl7OA9yWAk0QD3";
    const PERSONAL_SHIELD_ROLE_POINTS_ID = "Compendium.essence20.gi_joe_crb.Item.84JYgd6kZgY41wge";

    function makeActor({ perkIds = [], shieldActive = true } = {}) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));

      return {
        system: { health: { value: 10 }, immunities: {} },
        update: jest.fn(),
        _getBaseRolePoints: jest.fn(() => ({
          flags: { core: { sourceId: PERSONAL_SHIELD_ROLE_POINTS_ID } },
          system: { isActive: shieldActive },
        })),
        items,
      };
    }

    test("zeroes out EMP damage while the shield is active", async () => {
      const actor = makeActor({ perkIds: [IMPENETRABLE_SHIELD_ID] });
      const applied = await applyDamage(actor, 8, 'emp');
      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
      expect(applied).toBe(0);
    });

    test("doesn't apply to other damage types (resistance, not immunity - a Snag instead)", async () => {
      const actor = makeActor({ perkIds: [IMPENETRABLE_SHIELD_ID] });
      const applied = await applyDamage(actor, 8, 'fire');
      expect(applied).toBe(8);
    });

    test("doesn't apply without the shield active", async () => {
      const actor = makeActor({ perkIds: [IMPENETRABLE_SHIELD_ID], shieldActive: false });
      const applied = await applyDamage(actor, 8, 'emp');
      expect(applied).toBe(8);
    });

    test("doesn't apply without the Perk", async () => {
      const actor = makeActor();
      const applied = await applyDamage(actor, 8, 'emp');
      expect(applied).toBe(8);
    });
  });

  describe("Energy Mastery (Decepticon Directive, Elementalist Focus, p.54) - Immunity", () => {
    const ENERGY_AFFINITY_ID = "Compendium.essence20.decepticon_directive.Item.DgFY0ZmAtClAobiA";
    const ENERGY_MASTERY_ID = "Compendium.essence20.decepticon_directive.Item.bjR8V1BEc3CfrrDu";

    function makeActor({ hasMastery = true, choice = 'fire' } = {}) {
      const items = [{ type: 'perk', flags: { core: { sourceId: ENERGY_AFFINITY_ID } }, system: { choice } }];
      if (hasMastery) {
        items.push({ type: 'perk', flags: { core: { sourceId: ENERGY_MASTERY_ID } }, system: {} });
      }

      return { system: { health: { value: 10 }, immunities: {} }, update: jest.fn(), items };
    }

    test("zeroes out damage of the type originally chosen for Energy Affinity", async () => {
      const actor = makeActor();
      const applied = await applyDamage(actor, 8, 'fire');
      expect(applied).toBe(0);
    });

    test("doesn't apply to other damage types, without the Perk, or without Energy Affinity's own choice", async () => {
      const actor = makeActor();
      expect(await applyDamage(actor, 8, 'cold')).toBe(8);

      const noMasteryActor = makeActor({ hasMastery: false });
      expect(await applyDamage(noMasteryActor, 8, 'fire')).toBe(8);
    });
  });

  describe("Hardened Armor (Across the Stars, Gold Ranger, 1st level) - Resistance for the rest of the scene after a hit", () => {
    const HARDENED_ARMOR_ID = "Compendium.essence20.across_the_stars.Item.LVyy4985HSSKCnGs";

    function makeActor({ perkIds = [], resistances = {} } = {}) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));

      return {
        system: { health: { value: 10 }, immunities: {}, resistances }, update: jest.fn(), setFlag: jest.fn(), items,
      };
    }

    test("grants Resistance to a damage type once real damage of that type lands", async () => {
      const actor = makeActor({ perkIds: [HARDENED_ARMOR_ID] });
      await applyDamage(actor, 3, 'fire');
      expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'sceneResistances.fire', expect.objectContaining({ window: 'scene', morphedOnly: false }));
      expect(actor.update).not.toHaveBeenCalledWith({ 'system.resistances.fire': true });
    });

    test("also applies to Stun-type damage", async () => {
      const actor = { ...makeActor({ perkIds: [HARDENED_ARMOR_ID] }), toggleStatusEffect: jest.fn() };
      actor.system.stun = { value: 0 };
      await applyDamage(actor, 2, 'stun');
      expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'sceneResistances.stun', expect.objectContaining({ window: 'scene', morphedOnly: false }));
      expect(actor.update).not.toHaveBeenCalledWith({ 'system.resistances.stun': true });
    });

    test("doesn't grant Resistance to Blunt or Sharp damage", async () => {
      for (const damageType of ['blunt', 'sharp']) {
        const actor = makeActor({ perkIds: [HARDENED_ARMOR_ID] });
        await applyDamage(actor, 3, damageType);
        expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', `sceneResistances.${damageType}`, expect.anything());
      }
    });

    test("doesn't grant Resistance without the Perk", async () => {
      const actor = makeActor();
      await applyDamage(actor, 3, 'fire');
      expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'sceneResistances.fire', expect.anything());
    });

    test("doesn't re-grant Resistance the actor already has", async () => {
      const actor = makeActor({ perkIds: [HARDENED_ARMOR_ID], resistances: { fire: true } });
      await applyDamage(actor, 3, 'fire');
      expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'sceneResistances.fire', expect.anything());
    });

    test("doesn't grant Resistance when no damage actually landed (Immune)", async () => {
      const actor = makeActor({ perkIds: [HARDENED_ARMOR_ID] });
      actor.system.immunities = { fire: true };
      await applyDamage(actor, 3, 'fire');
      expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'sceneResistances.fire', expect.anything());
    });
  });

  describe("Tough Enough - the effect's own damage is halved", () => {
    const TOUGH_ENOUGH_ID = "Compendium.essence20.gi_joe_crb.Item.RoIa80w6EAZR0uFP";
    const holder = { items: [{ type: 'perk', flags: { core: { sourceId: TOUGH_ENOUGH_ID } } }] };

    test("halves, rounding up, for a holder only", () => {
      expect(toughEnoughDamage(holder, 5)).toBe(3);
      expect(toughEnoughDamage(holder, 4)).toBe(2);
      expect(toughEnoughDamage(holder, 1)).toBe(1);
      expect(toughEnoughDamage(holder, 0)).toBe(0);
      expect(toughEnoughDamage({ items: [] }, 5)).toBe(5);
    });
  });

  describe("Elemental Adaptation (Across the Stars, Grid Power, p.72) - Resistance after a hit", () => {
    const GRID_ELEMENTAL_ADAPTATION_ID = "Compendium.essence20.across_the_stars.Item.5HNnSeIg4JKXiv2F";

    function makeActor({ hasPower = true, resistances = {}, power = 1, used = false } = {}) {
      const items = hasPower ? [{ type: 'power', flags: { core: { sourceId: GRID_ELEMENTAL_ADAPTATION_ID } } }] : [];
      const flagStore = used ? { gridElementalAdaptationUsedThisEncounter: { epoch: 1, window: 'encounter', count: 1 } } : {};

      return {
        system: { health: { value: 10 }, immunities: {}, resistances, powers: { personal: { value: power } } },
        update: jest.fn(async function (data) {
          Object.assign(this.system.powers.personal, data['system.powers.personal.value'] !== undefined ? { value: data['system.powers.personal.value'] } : {});
        }),
        items,
        getFlag: jest.fn((scope, key) => flagStore[key]),
        setFlag: jest.fn(async (scope, key, value) => {
          flagStore[key] = value; 
        }),
      };
    }

    let originalGame;
    beforeEach(() => {
      originalGame = global.game;
      global.game = { combat: { id: 'combat1' } };
    });
    afterEach(() => {
      global.game = originalGame;
    });

    test("grants Resistance and spends 1 Power on an Energy-type hit", async () => {
      const actor = makeActor({ power: 2 });

      await applyDamage(actor, 3, 'fire');

      // The Resistance is scene-long and for the Morphed form only (mechanics/world/token-sync.mjs#grantSceneResistance).
      expect(actor.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.powers.personal.value': 1 }));
      expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'sceneResistances.fire', expect.objectContaining({ window: 'scene', morphedOnly: true }));
      expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'gridElementalAdaptationUsedThisEncounter', { epoch: 1, window: 'encounter', count: 1 });
    });

    test("doesn't apply to a non-Energy damage type", async () => {
      const actor = makeActor();
      await applyDamage(actor, 3, 'sharp');
      expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.resistances.sharp': expect.anything() }));
    });

    test("doesn't apply without the Power, without affordable Power, already Resistant, or already used this scene", async () => {
      await applyDamage(makeActor({ hasPower: false }), 3, 'fire');
      await applyDamage(makeActor({ power: 0 }), 3, 'cold');
      await applyDamage(makeActor({ resistances: { electric: true } }), 3, 'electric');
      const usedActor = makeActor({ used: true });
      await applyDamage(usedActor, 3, 'fire');
      expect(usedActor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.resistances.fire': expect.anything() }));
    });
  });

  describe("Supreme Guardian (Through the Shattered Grid, Guardian of Eltar, 20th level, p.73) - Eltarian Tech regen", () => {
    const SUPREME_GUARDIAN_ID = "Compendium.essence20.through_the_shattered_grid.Item.wrBndkBQoKkn3dLy";

    function makeActor({ hasPerk = true, techValue = 1, techMax = 3 } = {}) {
      const rolePoints = {
        system: { resource: { value: techValue, max: techMax }, bonus: { type: 'none' }, isActivatable: false },
        update: jest.fn(),
      };
      const items = hasPerk ? [{ type: 'perk', flags: { core: { sourceId: SUPREME_GUARDIAN_ID } } }] : [];

      return {
        system: { health: { value: 10 }, immunities: {}, resistances: {} },
        update: jest.fn(),
        items,
        _getBaseRolePoints: jest.fn(() => rolePoints),
        __rolePoints: rolePoints,
      };
    }

    let originalRoll;
    beforeEach(() => {
      originalRoll = global.Roll;
    });
    afterEach(() => {
      global.Roll = originalRoll;
    });

    test("regains 1 Eltarian Tech Point on a roll of 10 or above", async () => {
      global.Roll = class {
        async evaluate() {
          this.total = 10; return this; 
        }
      };
      const actor = makeActor({ techValue: 1 });

      await applyDamage(actor, 3, 'fire');

      expect(actor.__rolePoints.update).toHaveBeenCalledWith({ 'system.resource.value': 2 });
    });

    test("doesn't regain anything on a roll below 10", async () => {
      global.Roll = class {
        async evaluate() {
          this.total = 9; return this; 
        }
      };
      const actor = makeActor({ techValue: 1 });

      await applyDamage(actor, 3, 'fire');

      expect(actor.__rolePoints.update).not.toHaveBeenCalled();
    });

    test("caps the regen at the resource's own max", async () => {
      global.Roll = class {
        async evaluate() {
          this.total = 20; return this; 
        }
      };
      const actor = makeActor({ techValue: 3, techMax: 3 });

      await applyDamage(actor, 3, 'fire');

      expect(actor.__rolePoints.update).toHaveBeenCalledWith({ 'system.resource.value': 3 });
    });

    test("doesn't roll or regain without the Perk", async () => {
      global.Roll = class {
        async evaluate() {
          this.total = 20; return this; 
        }
      };
      const actor = makeActor({ hasPerk: false });

      await applyDamage(actor, 3, 'fire');

      expect(actor.__rolePoints.update).not.toHaveBeenCalled();
    });

    test("doesn't apply to a non-Energy damage type", async () => {
      global.Roll = class {
        async evaluate() {
          this.total = 20; return this; 
        }
      };
      const actor = makeActor();

      await applyDamage(actor, 3, 'sharp');

      expect(actor.__rolePoints.update).not.toHaveBeenCalled();
    });

    test("doesn't apply when no damage actually landed (Immune)", async () => {
      global.Roll = class {
        async evaluate() {
          this.total = 20; return this; 
        }
      };
      const actor = makeActor();
      actor.system.immunities = { fire: true };

      await applyDamage(actor, 3, 'fire');

      expect(actor.__rolePoints.update).not.toHaveBeenCalled();
    });
  });

  // Sensitive's Snag on taking damage is a takesDamage Trigger on the Hang-Up (rules/conv10-slE10.test.js).

  describe("Flame Warlord (Finster's Monster-Matic Cookbook, 20th level) - Monster Form damage reduction", () => {
    const FLAME_WARLORD_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.TPrNnDxBKHIajafY";

    function makeActor({ perkId, monsterForm = true } = {}) {
      const items = perkId ? [{ type: 'perk', flags: { core: { sourceId: perkId } } }] : [];
      const flagStore = monsterForm ? { monsterFormActive: true } : {};
      return {
        system: { health: { value: 10 }, immunities: {}, resistances: {}, powers: { personal: { value: 0 } } },
        update: jest.fn(), items,
        setFlag: jest.fn(), getFlag: jest.fn((scope, key) => flagStore[key]),
      };
    }

    test("Flame Warlord reduces non-Element damage by 1 while in Monster Form", async () => {
      const actor = makeActor({ perkId: FLAME_WARLORD_ID });
      await applyDamage(actor, 3, 'blunt');
      expect(actor.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.health.value': 8 })); // 10 - (3-1)
    });

    test("Flame Warlord does NOT reduce Element/Energy damage", async () => {
      const actor = makeActor({ perkId: FLAME_WARLORD_ID });
      await applyDamage(actor, 3, 'fire');
      expect(actor.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.health.value': 7 })); // 10 - 3
    });

    test("no reduction outside Monster Form, even with the Perk", async () => {
      const actor = makeActor({ perkId: FLAME_WARLORD_ID, monsterForm: false });
      await applyDamage(actor, 3, 'poison');
      expect(actor.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.health.value': 7 })); // 10 - 3
    });

    test("floors at 0 reduction, never negative damage", async () => {
      const actor = makeActor({ perkId: FLAME_WARLORD_ID });
      await applyDamage(actor, 0, 'poison');
      expect(actor.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.health.value': 10 }));
    });
  });

  describe("Cruel Warlord (Finster's Monster-Matic Cookbook, 20th level, p.284) - Power regen on Psychic damage", () => {
    const CRUEL_WARLORD_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.F3TRKmoaUOtHrlzq";

    function makeActor({ hasPerk = true, power = 1, max = 5 } = {}) {
      const items = hasPerk ? [{ type: 'perk', flags: { core: { sourceId: CRUEL_WARLORD_ID } } }] : [];
      return {
        system: { health: { value: 10 }, immunities: {}, resistances: {}, powers: { personal: { value: power, max } } },
        update: jest.fn(), items, setFlag: jest.fn(), getFlag: jest.fn(),
      };
    }

    test("regains 2 Personal Power when Psychic damage lands", async () => {
      const actor = makeActor({ power: 1 });
      await applyDamage(actor, 3, 'psychic');
      expect(actor.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.powers.personal.value': 3 }));
    });

    test("doesn't apply for a different damage type", async () => {
      const actor = makeActor({ power: 1 });
      await applyDamage(actor, 3, 'sharp');
      expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.powers.personal.value': 3 }));
    });

    test("caps at the actor's own Personal Power max", async () => {
      const actor = makeActor({ power: 4, max: 5 });
      await applyDamage(actor, 3, 'psychic');
      expect(actor.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.powers.personal.value': 5 }));
    });

    test("doesn't apply without the Perk", async () => {
      const actor = makeActor({ hasPerk: false, power: 1 });
      await applyDamage(actor, 3, 'psychic');
      expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.powers.personal.value': 3 }));
    });
  });

  describe("At All Cost (Through the Shattered Grid, Magna Defender, 18th level, p.25) - damage-to-Power conversion", () => {
    function makeActor({ active = false, power = 3, health = 5 } = {}) {
      const flagStore = { atAllCostActive: active };
      return {
        system: { health: { value: health }, immunities: {}, powers: { personal: { value: power } } },
        update: jest.fn(),
        getFlag: jest.fn((scope, key) => flagStore[key]),
        setFlag: jest.fn((scope, key, value) => {
          flagStore[key] = value; 
        }),
        unsetFlag: jest.fn((scope, key) => {
          flagStore[key] = undefined; 
        }),
        toggleStatusEffect: jest.fn(),
      };
    }

    test("diverts the damage to Power loss instead of Health while active", async () => {
      const actor = makeActor({ active: true, power: 3 });
      const applied = await applyDamage(actor, 2, 'sharp');

      expect(applied).toBe(2);
      expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 1 });
      expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.health.value': expect.anything() }));
    });

    test("auto-reverts once Power hits 0", async () => {
      const actor = makeActor({ active: true, power: 1 });
      await applyDamage(actor, 5, 'sharp');

      expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
      expect(actor.toggleStatusEffect).toHaveBeenCalledWith('unconscious', { active: true });
      expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: true });
      expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'atAllCostActive');
    });

    test("normal Health loss applies when inactive", async () => {
      const actor = makeActor({ active: false, health: 5 });
      const applied = await applyDamage(actor, 2, 'sharp');

      expect(applied).toBe(2);
      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 3 });
    });

    test("doesn't intercept Stun-type damage", async () => {
      const actor = { ...makeActor({ active: true }), toggleStatusEffect: jest.fn() };
      actor.system.stun = { value: 0 };
      await applyDamage(actor, 2, 'stun');

      expect(actor.update).toHaveBeenCalledWith({ 'system.stun.value': 2 });
      expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.powers.personal.value': expect.anything() }));
    });
  });

  describe("Wisdom of the Elders - Resilient Armor (Through the Shattered Grid, Guardian of Eltar, 9th/18th level) - flat damage reduction", () => {
    function makeActor({ active = true, health = 10 } = {}) {
      return {
        system: { health: { value: health }, immunities: {} },
        update: jest.fn(),
        getFlag: jest.fn((scope, key) => (
          key == 'wisdomOfTheEldersActive' && active ? { resilientArmor: true } : undefined
        )),
      };
    }

    test("reduces any damage type by 1 while active, floored at 0", async () => {
      const actor = makeActor({ active: true });
      expect(await applyDamage(actor, 3, 'sharp')).toBe(2);
    });

    test("floors at 0 rather than going negative", async () => {
      const actor = makeActor({ active: true });
      expect(await applyDamage(actor, 1, 'fire')).toBe(0);
    });

    test("doesn't apply while inactive", async () => {
      const actor = makeActor({ active: false });
      expect(await applyDamage(actor, 3, 'sharp')).toBe(3);
    });
  });

  describe("Elemental Shield (Beneath the Helmet, Aqua Ranger, 9th/18th level) - banked Energy damage reduction", () => {
    const PENDING_ELEMENTAL_SHIELD_FLAG_KEY = 'pendingElementalShield';

    function makeActor({ pending = null, health = 10 } = {}) {
      return {
        system: { health: { value: health }, immunities: {} },
        update: jest.fn(),
        getFlag: jest.fn((scope, key) => (key == PENDING_ELEMENTAL_SHIELD_FLAG_KEY ? pending : undefined)),
        unsetFlag: jest.fn(),
      };
    }

    test("reduces an Energy hit by the banked amount and clears the flag", async () => {
      const actor = makeActor({ pending: { amount: 2, combatId: null, round: null } });
      const applied = await applyDamage(actor, 5, 'fire');
      expect(applied).toBe(3);
      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 7 });
      expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', PENDING_ELEMENTAL_SHIELD_FLAG_KEY);
    });

    test("floors at 0 rather than going negative", async () => {
      const actor = makeActor({ pending: { amount: 5, combatId: null, round: null } });
      const applied = await applyDamage(actor, 2, 'element');
      expect(applied).toBe(0);
    });

    test("applies to any Element sub-type, not just the generic 'element' key", async () => {
      const actor = makeActor({ pending: { amount: 1, combatId: null, round: null } });
      const applied = await applyDamage(actor, 3, 'electric');
      expect(applied).toBe(2);
    });

    test("doesn't apply to a non-Energy damage type", async () => {
      const actor = makeActor({ pending: { amount: 2, combatId: null, round: null } });
      const applied = await applyDamage(actor, 5, 'sharp');
      expect(applied).toBe(5);
      expect(actor.unsetFlag).not.toHaveBeenCalled();
    });

    test("doesn't touch the flag when nothing is banked", async () => {
      const actor = makeActor({ pending: null });
      const applied = await applyDamage(actor, 5, 'fire');
      expect(applied).toBe(5);
      expect(actor.unsetFlag).not.toHaveBeenCalled();
    });

    test("doesn't consume the flag against a hit already zeroed by Immunity", async () => {
      const actor = makeActor({ pending: { amount: 2, combatId: null, round: null } });
      actor.system.immunities = { fire: true };
      const applied = await applyDamage(actor, 5, 'fire');
      expect(applied).toBe(0);
      expect(actor.unsetFlag).not.toHaveBeenCalled();
    });
  });

  describe("Dig Deep (WTNV Citizen's Guide, General Perk, p.47) - banked damage reduction", () => {
    const PENDING_DIG_DEEP_FLAG_KEY = 'pendingDigDeep';

    function makeActor({ pending = null, health = 10 } = {}) {
      return {
        system: { health: { value: health }, immunities: {} },
        update: jest.fn(),
        getFlag: jest.fn((scope, key) => (key == PENDING_DIG_DEEP_FLAG_KEY ? pending : undefined)),
        unsetFlag: jest.fn(),
      };
    }

    test("reduces a hit of ANY damage type by the banked amount and clears the flag", async () => {
      const actor = makeActor({ pending: { amount: 1, combatId: null, round: null } });
      const applied = await applyDamage(actor, 5, 'sharp');
      expect(applied).toBe(4);
      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 6 });
      expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', PENDING_DIG_DEEP_FLAG_KEY);
    });

    test("floors at 0 rather than going negative", async () => {
      const actor = makeActor({ pending: { amount: 5, combatId: null, round: null } });
      const applied = await applyDamage(actor, 1, 'sharp');
      expect(applied).toBe(0);
    });

    test("doesn't touch the flag when nothing is banked", async () => {
      const actor = makeActor({ pending: null });
      const applied = await applyDamage(actor, 5, 'sharp');
      expect(applied).toBe(5);
      expect(actor.unsetFlag).not.toHaveBeenCalled();
    });

    test("doesn't consume the flag against a hit already zeroed by Immunity", async () => {
      const actor = makeActor({ pending: { amount: 1, combatId: null, round: null } });
      actor.system.immunities = { sharp: true };
      const applied = await applyDamage(actor, 5, 'sharp');
      expect(applied).toBe(0);
      expect(actor.unsetFlag).not.toHaveBeenCalled();
    });
  });

  describe("Immortal Rebel Soul (WTNV Citizen's Guide, Soldier Role, StrexCorp Rebel Focus, p.46)", () => {
    const IMMORTAL_REBEL_SOUL_ID = "Compendium.essence20.wtnv_citizens_guide.Item.SYFScAH8lDshgLNM";

    function makeActor({ health = 3, usedFlag = undefined, hasPerk = true } = {}) {
      const flags = usedFlag !== undefined ? { immortalRebelSoulUsedThisEncounter: usedFlag } : {};
      return {
        system: { health: { value: health }, immunities: {} },
        items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: IMMORTAL_REBEL_SOUL_ID } } }] : [],
        update: jest.fn(),
        getFlag: jest.fn((scope, key) => flags[key]),
        setFlag: jest.fn(async (scope, key, value) => {
          flags[key] = value; 
        }),
        unsetFlag: jest.fn(),
      };
    }

    beforeEach(() => {
      global.game = { combat: { id: 'combat1' } };
    });

    test("floors Health at 1 instead of 0, and marks the scene used", async () => {
      const actor = makeActor({ health: 3 });
      const applied = await applyDamage(actor, 5, 'sharp');

      expect(applied).toBe(2); // 3 -> 1, not the full 5
      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 1 });
      expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'immortalRebelSoulUsedThisEncounter', { epoch: 1, window: 'encounter', count: 1 });
    });

    test("doesn't apply a second time in the same scene", async () => {
      const actor = makeActor({ health: 3, usedFlag: { epoch: 1, window: 'encounter', count: 1 } });
      const applied = await applyDamage(actor, 5, 'sharp');

      expect(applied).toBe(3);
      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
    });

    test("doesn't apply without the Perk, or when Health doesn't actually reach 0", async () => {
      const noPerkActor = makeActor({ health: 3, hasPerk: false });
      await applyDamage(noPerkActor, 5, 'sharp');
      expect(noPerkActor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });

      const healthyActor = makeActor({ health: 10 });
      await applyDamage(healthyActor, 5, 'sharp');
      expect(healthyActor.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
      expect(healthyActor.setFlag).not.toHaveBeenCalled();
    });
  });

  describe("Life Supporting (Cobra Codex, Restricted Battledress Upgrade, p.101)", () => {
    const LIFE_SUPPORTING_ID = "Compendium.essence20.cobra_codex.Item.VokHpoLjUYTzA3Xk";

    function makeActor({ health = 3, spent = false, hasUpgrade = true, parentId = undefined } = {}) {
      const upgrade = {
        type: 'upgrade',
        name: 'Life Supporting',
        system: { type: 'armor' },
        flags: { core: { sourceId: LIFE_SUPPORTING_ID }, essence20: spent ? { lifeSupportingSpent: true } : {} },
        getFlag: jest.fn((scope, key) => (key == 'parentId' ? parentId : undefined)),
        setFlag: jest.fn(async function (scope, key, value) {
          this.flags.essence20[key] = value;
        }),
        unsetFlag: jest.fn(async function (scope, key) {
          delete this.flags.essence20[key];
        }),
      };
      const actor = {
        name: 'Tester',
        system: { health: { value: health }, immunities: {} },
        items: hasUpgrade ? [upgrade] : [],
        update: jest.fn(),
        getFlag: jest.fn(),
        setFlag: jest.fn(),
        unsetFlag: jest.fn(),
      };
      upgrade.parent = actor;
      return { actor, upgrade };
    }

    beforeEach(() => {
      global.game = { combat: { id: 'combat1' }, i18n: { format: (key) => key } };
    });

    test("floors Health at 1 instead of 0, and marks the Upgrade spent", async () => {
      const { actor, upgrade } = makeActor({ health: 3 });
      const applied = await applyDamage(actor, 5, 'sharp');

      expect(applied).toBe(2); // 3 -> 1, not the full 5
      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 1 });
      expect(upgrade.setFlag).toHaveBeenCalledWith('essence20', 'lifeSupportingSpent', true);
    });

    test("doesn't apply again until recharged, whatever the scene", async () => {
      const { actor } = makeActor({ health: 3, spent: true });
      const applied = await applyDamage(actor, 5, 'sharp');

      expect(applied).toBe(3);
      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
    });

    test("the DIF 20 Technology test recharges it on a success only", async () => {
      const { upgrade } = makeActor({ spent: true });
      const fail = jest.fn(async () => ({ success: false }));
      await rechargeLifeSupporting(upgrade, fail);
      expect(fail).toHaveBeenCalledWith(upgrade.parent, 'technology', 20);
      expect(upgrade.flags.essence20.lifeSupportingSpent).toBe(true);

      await rechargeLifeSupporting(upgrade, async () => ({ success: true }));
      expect(upgrade.flags.essence20.lifeSupportingSpent).toBeUndefined();
    });

    test("doesn't apply without the Upgrade, when Health doesn't reach 0, or for an attached (child) upgrade copy", async () => {
      const { actor: noUpgradeActor } = makeActor({ health: 3, hasUpgrade: false });
      await applyDamage(noUpgradeActor, 5, 'sharp');
      expect(noUpgradeActor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });

      const { actor: healthyActor, upgrade } = makeActor({ health: 10 });
      await applyDamage(healthyActor, 5, 'sharp');
      expect(healthyActor.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
      expect(upgrade.setFlag).not.toHaveBeenCalled();

      const { actor: attachedActor } = makeActor({ health: 3, parentId: 'someArmor1' });
      await applyDamage(attachedActor, 5, 'sharp');
      expect(attachedActor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
    });
  });

  describe("Aegis (GI Joe CRB, Tank Focus, 20th level, p.99)", () => {
    const AEGIS_ID = "Compendium.essence20.gi_joe_crb.Item.0ZTjZ36gN74889am";
    const RECKLESS_ABANDON_ID = "Compendium.essence20.gi_joe_crb.Item.84d0XTJwKCYMJUgY";

    function makeActor({ health = 3, hasPerk = true, recklessAbandonActive = true } = {}) {
      const rolePoints = { flags: { core: { sourceId: RECKLESS_ABANDON_ID } }, system: { isActive: recklessAbandonActive } };
      return {
        system: { health: { value: health }, immunities: {} },
        items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: AEGIS_ID } } }] : [],
        update: jest.fn(),
        getFlag: jest.fn(() => undefined),
        setFlag: jest.fn(),
        unsetFlag: jest.fn(),
        _getBaseRolePoints: jest.fn(() => rolePoints),
      };
    }

    test("floors Health at 1 and marks the clamp flag, with the Perk and Reckless Abandon active", async () => {
      const actor = makeActor({ health: 3 });

      const applied = await applyDamage(actor, 5, 'sharp');

      expect(applied).toBe(2); // 3 -> 1, not the full 5
      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 1 });
      expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'aegisClamped', true);
    });

    test("doesn't apply without the Perk", async () => {
      const actor = makeActor({ health: 3, hasPerk: false });

      await applyDamage(actor, 5, 'sharp');

      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
      expect(actor.setFlag).not.toHaveBeenCalled();
    });

    test("doesn't apply while Reckless Abandon isn't active", async () => {
      const actor = makeActor({ health: 3, recklessAbandonActive: false });

      await applyDamage(actor, 5, 'sharp');

      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
      expect(actor.setFlag).not.toHaveBeenCalled();
    });

    test("doesn't apply when Health doesn't actually reach 0", async () => {
      const actor = makeActor({ health: 10 });

      await applyDamage(actor, 5, 'sharp');

      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
      expect(actor.setFlag).not.toHaveBeenCalled();
    });
  });

  describe("Not Done Yet (GI Joe CRB, Renegade base, 5th level, p.97)", () => {
    const NOT_DONE_YET_ID = "Compendium.essence20.gi_joe_crb.Item.wGAWnAM5zUgcNP9c";
    const RECKLESS_ABANDON_ID = "Compendium.essence20.gi_joe_crb.Item.84d0XTJwKCYMJUgY";

    let originalGame;
    beforeEach(() => {
      originalGame = global.game;
      global.game = { combat: { id: 'combat1' } };
    });
    afterEach(() => {
      global.game = originalGame;
    });

    function makeActor({ health = 3, hasPerk = true, recklessAbandonActive = true, usedFlag = undefined } = {}) {
      const rolePoints = { flags: { core: { sourceId: RECKLESS_ABANDON_ID } }, system: { isActive: recklessAbandonActive } };
      const flags = usedFlag !== undefined ? { notDoneYetUsedThisEncounter: usedFlag } : {};
      return {
        system: { health: { value: health }, immunities: {} },
        items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: NOT_DONE_YET_ID } } }] : [],
        update: jest.fn(),
        getFlag: jest.fn((scope, key) => flags[key]),
        setFlag: jest.fn(async (scope, key, value) => {
          flags[key] = value; 
        }),
        unsetFlag: jest.fn(),
        _getBaseRolePoints: jest.fn(() => rolePoints),
      };
    }

    test("floors Health at 1 and marks the encounter used, with the Perk and Reckless Abandon active", async () => {
      const actor = makeActor({ health: 3 });

      const applied = await applyDamage(actor, 5, 'sharp');

      expect(applied).toBe(2); // 3 -> 1, not the full 5
      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 1 });
      expect(actor.setFlag).toHaveBeenCalledWith(
        'essence20', 'notDoneYetUsedThisEncounter', expect.objectContaining({ epoch: 1, window: 'encounter', count: 1 }),
      );
    });

    test("doesn't apply a second time in the same encounter, without the Perk, or without Reckless Abandon active", async () => {
      const usedActor = makeActor({ health: 3, usedFlag: { epoch: 1, window: 'encounter', count: 1 } });
      await applyDamage(usedActor, 5, 'sharp');
      expect(usedActor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });

      const noPerkActor = makeActor({ health: 3, hasPerk: false });
      await applyDamage(noPerkActor, 5, 'sharp');
      expect(noPerkActor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });

      const inactiveActor = makeActor({ health: 3, recklessAbandonActive: false });
      await applyDamage(inactiveActor, 5, 'sharp');
      expect(inactiveActor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
    });
  });

  describe("We are the Coinless (Through the Shattered Grid, Origin Benefit, p.20)", () => {
    const WE_ARE_THE_COINLESS_ID = "Compendium.essence20.through_the_shattered_grid.Item.DRHPP4jmrjNa53ZA";

    function makeActor({ health = 3, hasPerk = false } = {}) {
      return {
        name: 'Kimberly',
        system: { health: { value: health }, immunities: {} },
        items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: WE_ARE_THE_COINLESS_ID } } }] : [],
        update: jest.fn(),
        getFlag: jest.fn(() => undefined),
        setFlag: jest.fn(),
        toggleStatusEffect: jest.fn(),
        getActiveTokens: jest.fn(() => [{ document: { disposition: 1 }, center: { x: 0, y: 0 } }]),
      };
    }

    function makeTeammateToken({ hasPerk = true, disposition = 1, power = 2 } = {}) {
      const teammate = {
        name: 'Zack',
        system: { powers: { personal: { value: power } } },
        items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: WE_ARE_THE_COINLESS_ID } } }] : [],
        getFlag: jest.fn(() => undefined),
        setFlag: jest.fn(),
        update: jest.fn(),
      };
      return { actor: teammate, document: { disposition }, center: { x: 5, y: 0 } };
    }

    let originalGame;

    beforeEach(() => {
      global.canvas = { tokens: { placeables: [] }, grid: { measurePath: jest.fn(() => ({ distance: 5 })) } };
      // This is the one entry in applyDamage's Defeat-prevention chain that announces itself, so
      // it needs i18n/notifications the other entries' tests never touch.
      originalGame = global.game;
      global.game = { ...global.game, i18n: { format: jest.fn(() => 'msg'), localize: jest.fn(k => k) } };
      global.ui = { ...global.ui, notifications: { info: jest.fn(), warn: jest.fn() } };
      // "You may": the table is asked, and here says yes with the first teammate offered.
      originalFoundry = global.foundry;
      global.foundry = { ...(global.foundry ?? {}), applications: { api: { DialogV2: { wait: jest.fn(async () => 'rescuer0') } } } };
    });

    let originalFoundry;

    afterEach(() => {
      global.game = originalGame;
      global.foundry = originalFoundry;
    });

    test("asks first - declining leaves the actor Defeated and the Power unspent", async () => {
      const actor = makeActor({ health: 3 });
      const teammateToken = makeTeammateToken({ power: 2 });
      canvas.tokens.placeables = [teammateToken];
      foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('decline');

      await applyDamage(actor, 5, 'sharp');

      expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
      expect(teammateToken.actor.update).not.toHaveBeenCalled();
    });

    test("a teammate spends 1 Power to return the actor at 1 Health, Impaired", async () => {
      const actor = makeActor({ health: 3 });
      const teammateToken = makeTeammateToken({ power: 2 });
      canvas.tokens.placeables = [teammateToken];

      await applyDamage(actor, 5, 'sharp');

      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 1 });
      expect(teammateToken.actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 1 });
      expect(actor.toggleStatusEffect).toHaveBeenCalledWith('impaired', { active: true });
    });

    test("RAW says 'another member of your team', so it never rescues the holder themselves", async () => {
      const actor = makeActor({ health: 3, hasPerk: true });
      actor.system.powers = { personal: { value: 5 } };

      await applyDamage(actor, 5, 'sharp');

      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
    });

    test("doesn't fire when the teammate can't afford the Power, or is an enemy, or lacks the Perk", async () => {
      for (const token of [
        makeTeammateToken({ power: 0 }),
        makeTeammateToken({ disposition: -1 }),
        makeTeammateToken({ hasPerk: false }),
      ]) {
        const actor = makeActor({ health: 3 });
        canvas.tokens.placeables = [token];

        await applyDamage(actor, 5, 'sharp');

        expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
        expect(token.actor.update).not.toHaveBeenCalled();
      }
    });

    test("doesn't fire when Health never actually reaches 0", async () => {
      const actor = makeActor({ health: 10 });
      const teammateToken = makeTeammateToken();
      canvas.tokens.placeables = [teammateToken];

      await applyDamage(actor, 5, 'sharp');

      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
      expect(teammateToken.actor.update).not.toHaveBeenCalled();
    });

    test("RAW states no frequency cap, so a teammate with Power can rescue repeatedly", async () => {
      const teammateToken = makeTeammateToken({ power: 3 });
      canvas.tokens.placeables = [teammateToken];

      for (const expectedPower of [2, 2]) {
        const actor = makeActor({ health: 3 });
        await applyDamage(actor, 5, 'sharp');
        expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 1 });
        expect(teammateToken.actor.update).toHaveBeenLastCalledWith({
          'system.powers.personal.value': expectedPower,
        });
      }
    });
  });
});

describe("healStunAtTurnStart", () => {
  test("heals 1 Stun off the actor's current total", async () => {
    const actor = { system: { stun: { value: 3 } }, update: jest.fn(), toggleStatusEffect: jest.fn() };
    await healStunAtTurnStart(actor);
    expect(actor.update).toHaveBeenCalledWith({ 'system.stun.value': 2 });
  });

  test("floors at 0 rather than going negative", async () => {
    const actor = { system: { stun: { value: 0 } }, update: jest.fn(), toggleStatusEffect: jest.fn() };
    await healStunAtTurnStart(actor);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("no-ops for an actor with no Stun accumulated at all", async () => {
    const actor = { system: {}, update: jest.fn(), toggleStatusEffect: jest.fn() };
    await healStunAtTurnStart(actor);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("no-ops for a null/undefined actor", async () => {
    await expect(healStunAtTurnStart(null)).resolves.toBeUndefined();
    await expect(healStunAtTurnStart(undefined)).resolves.toBeUndefined();
  });

  test("clears the cantTakeMoveActions marker once Stun heals down to 0", async () => {
    const actor = { system: { stun: { value: 1 } }, update: jest.fn(), toggleStatusEffect: jest.fn() };
    await healStunAtTurnStart(actor);
    expect(actor.update).toHaveBeenCalledWith({ 'system.stun.value': 0 });
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('cantTakeMoveActions', { active: false });
  });

  test("doesn't clear the marker while Stun still remains above 0", async () => {
    const actor = { system: { stun: { value: 3 } }, update: jest.fn(), toggleStatusEffect: jest.fn() };
    await healStunAtTurnStart(actor);
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });

  describe("Megaform redirect", () => {
    function makeParticipant(stunValue) {
      return { type: 'zord', system: { stun: { value: stunValue } }, update: jest.fn(), toggleStatusEffect: jest.fn() };
    }

    beforeEach(() => {
      global.fromUuidSync.mockReset();
    });

    test("heals each linked participant's own Stun by 1, not the Megaform's own computed mirror", async () => {
      const a = makeParticipant(3);
      const b = makeParticipant(1);
      global.fromUuidSync.mockImplementation(uuid => (uuid == 'Actor.a' ? a : b));

      const megaform = {
        type: 'megaform',
        // Deliberately stale/wrong, to prove this is never written to directly - a real Megaform
        // would have this freshly computed by Essence20Actor#_prepareMegaformData instead.
        system: {
          stun: { value: 99 },
          subtype: [],
          actors: {
            z1: { uuid: 'Actor.a' },
            z2: { uuid: 'Actor.b' },
          },
        },
        update: jest.fn(),
      };

      await healStunAtTurnStart(megaform);

      expect(megaform.update).not.toHaveBeenCalled();
      expect(a.update).toHaveBeenCalledWith({ 'system.stun.value': 2 });
      expect(b.update).toHaveBeenCalledWith({ 'system.stun.value': 0 });
      expect(b.toggleStatusEffect).toHaveBeenCalledWith('cantTakeMoveActions', { active: false });
    });

    test("no-ops cleanly for a Megaform with no linked participants", async () => {
      const megaform = {
        type: 'megaform',
        system: { stun: { value: 0 }, subtype: [], actors: {} },
        update: jest.fn(),
      };

      await expect(healStunAtTurnStart(megaform)).resolves.toBeUndefined();
      expect(megaform.update).not.toHaveBeenCalled();
    });
  });
});

describe("_isCritIsFumble", () => {
  test("a natural 1 on the d20 is always a Fumble", () => {
    const [isCrit, isFumble] = _isCritIsFumble([{ faces: 20, values: [1] }], false);
    expect(isFumble).toBe(true);
    expect(isCrit).toBe(false);
  });

  test("max face on a non-d20 bonus die is a Critical Success", () => {
    const [isCrit] = _isCritIsFumble([{ faces: 20, values: [10] }, { faces: 6, values: [6] }], false);
    expect(isCrit).toBe(true);
  });

  test("a d2 showing its max face only crits when canCritD2 is true", () => {
    const dice = [{ faces: 20, values: [10] }, { faces: 2, values: [2] }];
    expect(_isCritIsFumble(dice, false)[0]).toBe(false);
    expect(_isCritIsFumble(dice, true)[0]).toBe(true);
  });

  test("a plain non-crit, non-fumble roll returns [false, false]", () => {
    const [isCrit, isFumble] = _isCritIsFumble([{ faces: 20, values: [10] }, { faces: 6, values: [3] }], false);
    expect(isCrit).toBe(false);
    expect(isFumble).toBe(false);
  });
});

describe("getSecondaryDamage", () => {
  test("returns {type, value} for a weaponEffect with a secondary damage component", () => {
    const item = { type: 'weaponEffect', system: { secondaryDamage: { type: 'stun', value: 1 } } };
    expect(getSecondaryDamage(item)).toEqual({ type: 'stun', value: 1 });
  });

  test("returns null when the item is not a weaponEffect", () => {
    const item = { type: 'weapon', system: { secondaryDamage: { type: 'stun', value: 1 } } };
    expect(getSecondaryDamage(item)).toBeNull();
  });

  test("returns null when forgone is true (Guardian Strikes etc.)", () => {
    const item = { type: 'weaponEffect', system: { secondaryDamage: { type: 'stun', value: 1 } } };
    expect(getSecondaryDamage(item, true)).toBeNull();
  });

  test("returns null when there is no type set (the default)", () => {
    const item = { type: 'weaponEffect', system: { secondaryDamage: { type: null, value: 0 } } };
    expect(getSecondaryDamage(item)).toBeNull();
  });

  test("returns null when the value is 0", () => {
    const item = { type: 'weaponEffect', system: { secondaryDamage: { type: 'stun', value: 0 } } };
    expect(getSecondaryDamage(item)).toBeNull();
  });

  test("returns null when the item is missing entirely", () => {
    expect(getSecondaryDamage(null)).toBeNull();
  });
});

describe("getSecondaryDamageForButton", () => {
  const flags = {
    checkResults: [
      { targetUuid: 'Actor.target1', secondaryDamage: { type: 'stun', value: 2, base: 1 } },
      { targetUuid: 'Actor.target2', secondaryDamage: null },
    ],
  };

  test("returns the scaled rider for the base Apply Damage button", () => {
    expect(getSecondaryDamageForButton(flags, 'Actor.target1:base', 'Actor.target1'))
      .toEqual({ type: 'stun', value: 2 });
  });

  test("returns the flat value for the Critical Success 'repeat the effect' button", () => {
    expect(getSecondaryDamageForButton(flags, 'Actor.target1:crit:double', 'Actor.target1'))
      .toEqual({ type: 'stun', value: 1 });
  });

  test("returns null for any other button key", () => {
    expect(getSecondaryDamageForButton(flags, 'Actor.target1:half', 'Actor.target1')).toBeNull();
  });

  test("returns null when the target's checkResults entry has no secondary damage", () => {
    expect(getSecondaryDamageForButton(flags, 'Actor.target2:base', 'Actor.target2')).toBeNull();
  });

  test("returns null when flags/checkResults are missing entirely", () => {
    expect(getSecondaryDamageForButton(null, 'Actor.target1:base', 'Actor.target1')).toBeNull();
    expect(getSecondaryDamageForButton({}, 'Actor.target1:base', 'Actor.target1')).toBeNull();
  });
});
