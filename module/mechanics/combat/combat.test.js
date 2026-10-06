import { jest } from '@jest/globals';
import {
  getDefenseValue, getVehicleDriver, getOwnedZord, computeMultiplier, getEffectiveLevel, applyDamage,
  healStunAtTurnStart, _isCritIsFumble, getSecondaryDamage,
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
      // Relic Key's default is its Feature's DriverlessEssence rule (rules/plugins/zords/driverless-essence.mjs).
      if (hasRelicKey) {
        features.push({ id: 'rk', type: 'feature', flags: { core: { sourceId: RELIC_KEY_ID } }, system: { rules: [{ type: 'DriverlessEssence', label: 'Relic Key', essence: 3 }] } });
      }

      // Zord Sentience's too (round 17 - rules/conv17-split2.test.js).
      if (hasZordSentience) {
        features.push({ id: 'zs', type: 'feature', flags: { core: { sourceId: ZORD_SENTIENCE_ID } }, system: { rules: [{ type: 'DriverlessEssence', label: 'Zord Sentience', essence: 2, when: ['self:type:zord'] }] } });
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

    test("Zord Sentience defaults to a Smarts/Social of 2 when unpiloted (its DriverlessEssence rule)", () => {
      const zord = makeZord({ hasZordSentience: true, base: 10, bonus: 1, armor: 0, shield: 0 });
      expect(getDefenseValue(zord, 'willpower')).toBe(13);
      // With Relic Key as well, the higher default wins.
      expect(getDefenseValue(makeZord({ hasZordSentience: true, hasRelicKey: true, base: 10, bonus: 1 }), 'willpower')).toBe(14);
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

    // Health reaching 0 is the item's droppedToZero watch Trigger now; a code prompt here as well was the
    // two-prompts double (audit fix 2026-10-07).
    test("does NOT post the code prompt when ordinary damage defeats the target (the item's Trigger does)", async () => {
      const actor = makeDefeatedActor({ health: 5 });
      placeHolderNearby(actor);

      await applyDamage(actor, 10, 'sharp');

      expect(global.ChatMessage.create).not.toHaveBeenCalled();
    });

    test("prompts a nearby ally holding the Perk when Stun defeats the target", async () => {
      const actor = makeDefeatedActor({ health: 5, stun: 3 });
      placeHolderNearby(actor);

      await applyDamage(actor, 2, 'stun'); // 3 + 2 = 5, matches Health

      expect(global.ChatMessage.create).toHaveBeenCalledTimes(1);
    });

    test("doesn't prompt again for Stun against an actor who was already Defeated", async () => {
      const actor = makeDefeatedActor({ health: 0, alreadyDefeated: true });
      placeHolderNearby(actor);

      await applyDamage(actor, 3, 'stun');

      expect(global.ChatMessage.create).not.toHaveBeenCalled();
    });

    test("doesn't prompt when the Stun doesn't actually defeat the target", async () => {
      const actor = makeDefeatedActor({ health: 10 });
      placeHolderNearby(actor);

      await applyDamage(actor, 3, 'stun');

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

  // Sensitive's Snag on taking damage is a takesDamage Trigger on the Hang-Up (rules/conv10-slE10.test.js).

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

  // Elemental Shield's banked Energy damage reduction is a damageShield step on the Perk (rules/conv15-items2.test.js).

  // Aegis is a wouldBeDefeated Trigger at stage aegis on the Perk (rules/conv15-items2.test.js).

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
