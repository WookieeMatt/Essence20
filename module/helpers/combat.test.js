import { jest } from '@jest/globals';
import {
  getDefenseValue, computeMultiplier, getEffectiveLevel, applyDamage, healStunAtTurnStart, _isCritIsFumble,
  grantToughEnoughResistance,
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

  describe("Hardened Armor (Across the Stars, Gold Ranger, 1st level) - Resistance after a hit", () => {
    const HARDENED_ARMOR_ID = "Compendium.essence20.across_the_stars.Item.LVyy4985HSSKCnGs";

    function makeActor({ perkIds = [], resistances = {} } = {}) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));

      return {
        system: { health: { value: 10 }, immunities: {}, resistances }, update: jest.fn(), items,
      };
    }

    test("grants Resistance to a damage type once real damage of that type lands", async () => {
      const actor = makeActor({ perkIds: [HARDENED_ARMOR_ID] });
      await applyDamage(actor, 3, 'fire');
      expect(actor.update).toHaveBeenCalledWith({ 'system.resistances.fire': true });
    });

    test("also applies to Stun-type damage", async () => {
      const actor = { ...makeActor({ perkIds: [HARDENED_ARMOR_ID] }), toggleStatusEffect: jest.fn() };
      actor.system.stun = { value: 0 };
      await applyDamage(actor, 2, 'stun');
      expect(actor.update).toHaveBeenCalledWith({ 'system.resistances.stun': true });
    });

    test("doesn't grant Resistance without the Perk", async () => {
      const actor = makeActor();
      await applyDamage(actor, 3, 'fire');
      expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.resistances.fire': expect.anything() }));
    });

    test("doesn't re-grant Resistance the actor already has", async () => {
      const actor = makeActor({ perkIds: [HARDENED_ARMOR_ID], resistances: { fire: true } });
      await applyDamage(actor, 3, 'fire');
      expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.resistances.fire': expect.anything() }));
    });

    test("doesn't grant Resistance when no damage actually landed (Immune)", async () => {
      const actor = makeActor({ perkIds: [HARDENED_ARMOR_ID] });
      actor.system.immunities = { fire: true };
      await applyDamage(actor, 3, 'fire');
      expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.resistances.fire': expect.anything() }));
    });
  });

  describe("Tough Enough (GI Joe CRB, Tank Focus, 6th level, p.99) - Resistance-after-hit half", () => {
    const TOUGH_ENOUGH_ID = "Compendium.essence20.gi_joe_crb.Item.RoIa80w6EAZR0uFP";

    function makeActor({ perkIds = [], resistances = {} } = {}) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      return { system: { resistances }, update: jest.fn(), items };
    }

    test("grants Resistance to a damage type once real damage of that type lands", async () => {
      const actor = makeActor({ perkIds: [TOUGH_ENOUGH_ID] });
      await grantToughEnoughResistance(actor, 'fire', 3);
      expect(actor.update).toHaveBeenCalledWith({ 'system.resistances.fire': true });
    });

    test("doesn't grant Resistance without the Perk", async () => {
      const actor = makeActor();
      await grantToughEnoughResistance(actor, 'fire', 3);
      expect(actor.update).not.toHaveBeenCalled();
    });

    test("doesn't re-grant Resistance the actor already has", async () => {
      const actor = makeActor({ perkIds: [TOUGH_ENOUGH_ID], resistances: { fire: true } });
      await grantToughEnoughResistance(actor, 'fire', 3);
      expect(actor.update).not.toHaveBeenCalled();
    });

    test("doesn't grant Resistance when no damage actually landed", async () => {
      const actor = makeActor({ perkIds: [TOUGH_ENOUGH_ID] });
      await grantToughEnoughResistance(actor, 'fire', 0);
      expect(actor.update).not.toHaveBeenCalled();
    });
  });

  describe("Elemental Adaptation (Across the Stars, Grid Power, p.72) - Resistance after a hit", () => {
    const GRID_ELEMENTAL_ADAPTATION_ID = "Compendium.essence20.across_the_stars.Item.5HNnSeIg4JKXiv2F";

    function makeActor({ hasPower = true, resistances = {}, power = 1, used = false } = {}) {
      const items = hasPower ? [{ type: 'power', flags: { core: { sourceId: GRID_ELEMENTAL_ADAPTATION_ID } } }] : [];
      const flagStore = used ? { gridElementalAdaptationUsedThisEncounter: { combatId: 'combat1' } } : {};

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

      expect(actor.update).toHaveBeenCalledWith(expect.objectContaining({
        'system.resistances.fire': true, 'system.powers.personal.value': 1,
      }));
      expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'gridElementalAdaptationUsedThisEncounter', { combatId: 'combat1' });
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

  describe("Sensitive (MLP Precise Hang-Up, p.60) - Snag on taking Damage", () => {
    const SENSITIVE_ID = "Compendium.essence20.mlp_crb.Item.cLe7ettmAIaBUYIj";

    function makeActor({ hasPerk = true } = {}) {
      const items = hasPerk ? [{ type: 'perk', flags: { core: { sourceId: SENSITIVE_ID } } }] : [];
      return {
        system: { health: { value: 10 }, immunities: {}, resistances: {} },
        update: jest.fn(), items, setFlag: jest.fn(), getFlag: jest.fn(),
      };
    }

    test("banks a Snag once real damage lands", async () => {
      const actor = makeActor();
      await applyDamage(actor, 3, 'sharp');
      expect(actor.setFlag).toHaveBeenCalledWith(
        'essence20', 'pendingSensitiveSnag', expect.objectContaining({ snag: true }),
      );
    });

    test("also applies to Stun-type damage", async () => {
      const actor = { ...makeActor(), toggleStatusEffect: jest.fn() };
      actor.system.stun = { value: 0 };
      await applyDamage(actor, 2, 'stun');
      expect(actor.setFlag).toHaveBeenCalledWith(
        'essence20', 'pendingSensitiveSnag', expect.objectContaining({ snag: true }),
      );
    });

    test("doesn't bank anything without the Perk", async () => {
      const actor = makeActor({ hasPerk: false });
      await applyDamage(actor, 3, 'sharp');
      expect(actor.setFlag).not.toHaveBeenCalled();
    });

    test("doesn't bank anything when no damage actually landed (Immune)", async () => {
      const actor = makeActor();
      actor.system.immunities = { sharp: true };
      await applyDamage(actor, 3, 'sharp');
      expect(actor.setFlag).not.toHaveBeenCalled();
    });
  });

  describe("Push Through Pain (Finster's Monster-Matic Cookbook, Path of Cruelty, 2nd level) - Power regen on taking Damage", () => {
    const PUSH_THROUGH_PAIN_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.HhdIEMBVmXF8UsXu";

    function makeActor({ hasPerk = true, power = 1, max = 5 } = {}) {
      const items = hasPerk ? [{ type: 'perk', flags: { core: { sourceId: PUSH_THROUGH_PAIN_ID } } }] : [];
      return {
        system: { health: { value: 10 }, immunities: {}, resistances: {}, powers: { personal: { value: power, max } } },
        update: jest.fn(), items, setFlag: jest.fn(), getFlag: jest.fn(),
      };
    }

    test("regains 1 Personal Power when 2+ damage lands in a single attack", async () => {
      const actor = makeActor({ power: 1 });
      await applyDamage(actor, 2, 'sharp');
      expect(actor.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.powers.personal.value': 2 }));
    });

    test("doesn't apply for less than 2 damage", async () => {
      const actor = makeActor({ power: 1 });
      await applyDamage(actor, 1, 'sharp');
      expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.powers.personal.value': 2 }));
    });

    test("caps at the actor's own Personal Power max", async () => {
      const actor = makeActor({ power: 5, max: 5 });
      await applyDamage(actor, 2, 'sharp');
      expect(actor.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.powers.personal.value': 5 }));
    });

    test("doesn't apply without the Perk", async () => {
      const actor = makeActor({ hasPerk: false, power: 1 });
      await applyDamage(actor, 2, 'sharp');
      expect(actor.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.health.value': 8 }));
      expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.powers.personal.value': 2 }));
    });
  });

  describe("Flame/Frost/Stone Warlord (Finster's Monster-Matic Cookbook, all 20th level) - Monster Form damage reduction", () => {
    const FLAME_WARLORD_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.TPrNnDxBKHIajafY";
    const FROST_WARLORD_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.iFHlsLgUvmlT8cMK";
    const STONE_WARLORD_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.QlFNI9fQZXqO5N2J";

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

    test("Frost Warlord reduces Energy damage by 2 while in Monster Form", async () => {
      const actor = makeActor({ perkId: FROST_WARLORD_ID });
      await applyDamage(actor, 3, 'cold');
      expect(actor.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.health.value': 9 })); // 10 - (3-2)
    });

    test("Frost Warlord does NOT reduce non-Energy damage", async () => {
      const actor = makeActor({ perkId: FROST_WARLORD_ID });
      await applyDamage(actor, 3, 'blunt');
      expect(actor.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.health.value': 7 })); // 10 - 3
    });

    test("Stone Warlord reduces ALL damage types by 1 while in Monster Form", async () => {
      const actor = makeActor({ perkId: STONE_WARLORD_ID });
      await applyDamage(actor, 3, 'poison');
      expect(actor.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.health.value': 8 })); // 10 - (3-1)
    });

    test("no reduction outside Monster Form, even with the Perk", async () => {
      const actor = makeActor({ perkId: STONE_WARLORD_ID, monsterForm: false });
      await applyDamage(actor, 3, 'poison');
      expect(actor.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.health.value': 7 })); // 10 - 3
    });

    test("floors at 0 reduction, never negative damage", async () => {
      const actor = makeActor({ perkId: STONE_WARLORD_ID });
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

  describe("Adapted Wavelength (A Jump Through Time, Orange Ranger, Modified Shell III option) - flat Energy damage reduction", () => {
    const ADAPTED_WAVELENGTH_ID = "Compendium.essence20.jump_through_time.Item.nmMTFyzNTa9MDbP2";

    function makeItem(choice) {
      return { flags: { core: { sourceId: ADAPTED_WAVELENGTH_ID } }, system: { choice } };
    }

    function makeActor({ items = [], health = 10 } = {}) {
      return { system: { health: { value: health }, immunities: {} }, update: jest.fn(), items };
    }

    test("reduces a matching Element sub-type by 1, floored at 0", async () => {
      const actor = makeActor({ items: [makeItem('fire')] });
      const applied = await applyDamage(actor, 3, 'fire');
      expect(applied).toBe(2);
    });

    test("floors at 0 rather than going negative", async () => {
      const actor = makeActor({ items: [makeItem('fire')] });
      const applied = await applyDamage(actor, 1, 'fire');
      expect(applied).toBe(0);
    });

    test("doesn't apply to an unrelated Element sub-type", async () => {
      const actor = makeActor({ items: [makeItem('fire')] });
      const applied = await applyDamage(actor, 3, 'cold');
      expect(applied).toBe(3);
    });

    test("doesn't apply to a non-Energy damage type", async () => {
      const actor = makeActor({ items: [makeItem('fire')] });
      const applied = await applyDamage(actor, 3, 'sharp');
      expect(applied).toBe(3);
    });

    test("two instances with different elements each reduce their own matching type", async () => {
      const actor = makeActor({ items: [makeItem('fire'), makeItem('cold')] });
      expect(await applyDamage(actor, 3, 'fire')).toBe(2);
      expect(await applyDamage(actor, 3, 'cold')).toBe(2);
    });

    test("doesn't apply without the Perk at all", async () => {
      const actor = makeActor({ items: [] });
      const applied = await applyDamage(actor, 3, 'fire');
      expect(applied).toBe(3);
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

    test("stacks with Adapted Wavelength's own reduction for a matching Element type", async () => {
      const ADAPTED_WAVELENGTH_ID = "Compendium.essence20.jump_through_time.Item.nmMTFyzNTa9MDbP2";
      const actor = {
        ...makeActor({ active: true }),
        items: [{ flags: { core: { sourceId: ADAPTED_WAVELENGTH_ID } }, system: { choice: 'fire' } }],
      };
      expect(await applyDamage(actor, 5, 'fire')).toBe(3); // 5 - 1 (Adapted Wavelength) - 1 (Resilient Armor)
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
      expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'immortalRebelSoulUsedThisEncounter', { combatId: 'combat1' });
    });

    test("doesn't apply a second time in the same scene", async () => {
      const actor = makeActor({ health: 3, usedFlag: { combatId: 'combat1' } });
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

  describe("Renegade Commander (Sgt Slaughter Sourcebook, Alternate Renegade Role Perk, 5th level, p.12)", () => {
    const RENEGADE_COMMANDER_ID = "Compendium.essence20.sgt_slaughter_sourcebook.Item.JgJRqxXzTPBOlOBz";

    function makeActor({ health = 3, usedFlag = undefined, hasPerk = true } = {}) {
      const flags = usedFlag !== undefined ? { renegadeCommanderUsedThisEncounter: usedFlag } : {};
      return {
        system: { health: { value: health }, immunities: {} },
        items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: RENEGADE_COMMANDER_ID } } }] : [],
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
      expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'renegadeCommanderUsedThisEncounter', { combatId: 'combat1' });
    });

    test("doesn't apply a second time in the same scene", async () => {
      const actor = makeActor({ health: 3, usedFlag: { combatId: 'combat1' } });
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

  describe("Do Not Go Quietly (A Jump Through Time, Last of my Kind Origin Benefit, p.26)", () => {
    const DO_NOT_GO_QUIETLY_ID = "Compendium.essence20.jump_through_time.Item.llL4HUNxVJDNIaej";

    function makeActor({ health = 3, usedFlag = undefined, hasPerk = true } = {}) {
      const flags = usedFlag !== undefined ? { doNotGoQuietlyUsedThisEncounter: usedFlag } : {};
      return {
        system: { health: { value: health }, immunities: {} },
        items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: DO_NOT_GO_QUIETLY_ID } } }] : [],
        update: jest.fn(),
        getFlag: jest.fn((scope, key) => flags[key]),
        setFlag: jest.fn(async (scope, key, value) => {
          flags[key] = value; 
        }),
        unsetFlag: jest.fn(),
        toggleStatusEffect: jest.fn(),
      };
    }

    beforeEach(() => {
      global.game = { combat: { id: 'combat1' } };
    });

    test("floors Health at 1, applies Impaired, and marks the scene used", async () => {
      const actor = makeActor({ health: 3 });
      const applied = await applyDamage(actor, 5, 'sharp');

      expect(applied).toBe(2); // 3 -> 1, not the full 5
      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 1 });
      expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'doNotGoQuietlyUsedThisEncounter', { combatId: 'combat1' });
      expect(actor.toggleStatusEffect).toHaveBeenCalledWith('impaired', { active: true });
    });

    test("doesn't apply a second time in the same scene", async () => {
      const actor = makeActor({ health: 3, usedFlag: { combatId: 'combat1' } });
      const applied = await applyDamage(actor, 5, 'sharp');

      expect(applied).toBe(3);
      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
      expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    });

    test("doesn't apply without the Perk, or when Health doesn't actually reach 0", async () => {
      const noPerkActor = makeActor({ health: 3, hasPerk: false });
      await applyDamage(noPerkActor, 5, 'sharp');
      expect(noPerkActor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
      expect(noPerkActor.toggleStatusEffect).not.toHaveBeenCalled();

      const healthyActor = makeActor({ health: 10 });
      await applyDamage(healthyActor, 5, 'sharp');
      expect(healthyActor.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
      expect(healthyActor.setFlag).not.toHaveBeenCalled();
    });
  });

  describe("Baby Hold Together (GI Joe CRB, Mechanized Infantry Focus, 18th level, p.82)", () => {
    const BABY_HOLD_TOGETHER_ID = "Compendium.essence20.gi_joe_crb.Item.ybthZ8mmCSe3ZO84";

    function makeVehicleActor({ health = 3, usedFlag = undefined, driverUuid = 'Actor.driver1' } = {}) {
      const flags = usedFlag !== undefined ? { babyHoldTogetherUsedThisEncounter: usedFlag } : {};
      return {
        type: 'vehicle',
        system: {
          health: { value: health }, immunities: {},
          actors: driverUuid ? { a: { uuid: driverUuid, vehicleRole: 'driver' } } : {},
        },
        update: jest.fn(),
        getFlag: jest.fn((scope, key) => flags[key]),
        setFlag: jest.fn(async (scope, key, value) => {
          flags[key] = value; 
        }),
        unsetFlag: jest.fn(),
        toggleStatusEffect: jest.fn(),
      };
    }

    function makeDriverActor({ hasPerk = true } = {}) {
      return { items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: BABY_HOLD_TOGETHER_ID } } }] : [] };
    }

    beforeEach(() => {
      global.game = { combat: { id: 'combat1' } };
      global.fromUuid = jest.fn();
    });

    test("floors a Defeated vehicle's Health at 2 when the driver holds the Perk", async () => {
      const vehicle = makeVehicleActor({ health: 3 });
      global.fromUuid.mockResolvedValue(makeDriverActor());

      const applied = await applyDamage(vehicle, 5, 'sharp');

      expect(applied).toBe(1); // 3 -> 2, not the full 5
      expect(vehicle.update).toHaveBeenCalledWith({ 'system.health.value': 2 });
      expect(vehicle.setFlag).toHaveBeenCalledWith('essence20', 'babyHoldTogetherUsedThisEncounter', { combatId: 'combat1' });
    });

    test("doesn't apply a second time in the same encounter, without a driver holding the Perk, or on a non-vehicle", async () => {
      const usedVehicle = makeVehicleActor({ health: 3, usedFlag: { combatId: 'combat1' } });
      global.fromUuid.mockResolvedValue(makeDriverActor());
      await applyDamage(usedVehicle, 5, 'sharp');
      expect(usedVehicle.update).toHaveBeenCalledWith({ 'system.health.value': 0 });

      const noPerkVehicle = makeVehicleActor({ health: 3 });
      global.fromUuid.mockResolvedValue(makeDriverActor({ hasPerk: false }));
      await applyDamage(noPerkVehicle, 5, 'sharp');
      expect(noPerkVehicle.update).toHaveBeenCalledWith({ 'system.health.value': 0 });

      const nonVehicle = { type: 'character', system: { health: { value: 3 }, immunities: {} }, update: jest.fn() };
      await applyDamage(nonVehicle, 5, 'sharp');
      expect(nonVehicle.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
    });
  });

  describe("Defender's Oath (GI Joe CRB, Bodyguard Focus, 20th level, p.110)", () => {
    const DEFENDERS_OATH_ID = "Compendium.essence20.gi_joe_crb.Item.LuQoEjHVOM8Yoc0Y";

    function makeActor({ health = 3 } = {}) {
      return {
        system: { health: { value: health }, immunities: {} },
        items: [],
        update: jest.fn(),
        getFlag: jest.fn(() => undefined),
        setFlag: jest.fn(),
        unsetFlag: jest.fn(),
        // .document is needed by findWeAllGoHomeHolder's own disposition check, which (unlike
        // this describe's own hasNearbyDefendersOathProtection) scans canvas.tokens.placeables
        // for every applyDamage call that reaches 0 Health - harmless for every other field here,
        // but this one's own tests populate placeables, so the actor's own token needs it too.
        getActiveTokens: jest.fn(() => [{ document: { disposition: 1 }, center: { x: 0, y: 0 } }]),
      };
    }

    function makeBodyguardToken({
      hasPerk = true, isProtecting = true, defeated = false, distance = 5,
    } = {}) {
      const bodyguardActor = {
        items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: DEFENDERS_OATH_ID } } }] : [],
        getFlag: jest.fn((scope, key) => (
          key == 'protectedTargetUuid' && isProtecting ? 'Actor.target1' : undefined
        )),
        statuses: new Set(defeated ? ['defeated'] : []),
      };
      const token = { actor: bodyguardActor, document: { disposition: 1 }, center: { x: distance, y: 0 } };
      return token;
    }

    beforeEach(() => {
      global.canvas = {
        tokens: { placeables: [] },
        grid: { measurePath: jest.fn(() => ({ distance: 5 })) },
      };
    });

    test("floors Health at 1 with a nearby, non-Defeated Defender's Oath Bodyguard protecting this actor", async () => {
      const actor = makeActor({ health: 3 });
      actor.uuid = 'Actor.target1';
      canvas.tokens.placeables = [makeBodyguardToken()];

      const applied = await applyDamage(actor, 5, 'sharp');

      expect(applied).toBe(2); // 3 -> 1, not the full 5
      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 1 });
    });

    test("doesn't apply without a qualifying nearby Bodyguard", async () => {
      const actor = makeActor({ health: 3 });
      actor.uuid = 'Actor.target1';

      canvas.tokens.placeables = [makeBodyguardToken({ hasPerk: false })];
      await applyDamage(actor, 5, 'sharp');
      expect(actor.update).toHaveBeenLastCalledWith({ 'system.health.value': 0 });

      canvas.tokens.placeables = [makeBodyguardToken({ isProtecting: false })];
      await applyDamage(actor, 5, 'sharp');
      expect(actor.update).toHaveBeenLastCalledWith({ 'system.health.value': 0 });

      canvas.tokens.placeables = [makeBodyguardToken({ defeated: true })];
      await applyDamage(actor, 5, 'sharp');
      expect(actor.update).toHaveBeenLastCalledWith({ 'system.health.value': 0 });
    });

    test("doesn't apply beyond 10ft", async () => {
      const actor = makeActor({ health: 3 });
      actor.uuid = 'Actor.target1';
      canvas.grid.measurePath = jest.fn(() => ({ distance: 15 }));
      canvas.tokens.placeables = [makeBodyguardToken()];

      await applyDamage(actor, 5, 'sharp');

      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
    });

    test("doesn't apply when Health doesn't actually reach 0", async () => {
      const actor = makeActor({ health: 10 });
      actor.uuid = 'Actor.target1';
      canvas.tokens.placeables = [makeBodyguardToken()];

      await applyDamage(actor, 5, 'sharp');

      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    });
  });

  describe("Aegis (GI Joe CRB, Tank Focus, 20th level, p.99)", () => {
    const AEGIS_ID = "Compendium.essence20.gi_joe_crb.Item.CKQfEuHDNW6zP0FE";
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
        'essence20', 'notDoneYetUsedThisEncounter', expect.objectContaining({ combatId: 'combat1' }),
      );
    });

    test("doesn't apply a second time in the same encounter, without the Perk, or without Reckless Abandon active", async () => {
      const usedActor = makeActor({ health: 3, usedFlag: { combatId: 'combat1' } });
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

  describe("We All Go Home Or Nobody's Going Home (GI Joe CRB, Focus: Frontline Leader, 20th level, p.87)", () => {
    const WE_ALL_GO_HOME_ID = "Compendium.essence20.gi_joe_crb.Item.3NS825G6UdbdW7ZY";

    function makeActor({ health = 3, hasPerk = false } = {}) {
      return {
        system: { health: { value: health }, immunities: {} },
        items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: WE_ALL_GO_HOME_ID } } }] : [],
        update: jest.fn(),
        getFlag: jest.fn(() => undefined),
        setFlag: jest.fn(),
        getActiveTokens: jest.fn(() => [{ document: { disposition: 1 }, center: { x: 0, y: 0 } }]),
      };
    }

    function makeAllyToken({ hasPerk = true, disposition = 1 } = {}) {
      const allyActor = {
        items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: WE_ALL_GO_HOME_ID } } }] : [],
        getFlag: jest.fn(() => undefined),
        setFlag: jest.fn(),
      };
      return { actor: allyActor, document: { disposition }, center: { x: 5, y: 0 } };
    }

    beforeEach(() => {
      global.canvas = { tokens: { placeables: [] }, grid: { measurePath: jest.fn(() => ({ distance: 5 })) } };
    });

    test("floors Health at 1 when the actor holds the Perk themselves", async () => {
      const actor = makeActor({ health: 3, hasPerk: true });

      const applied = await applyDamage(actor, 5, 'sharp');

      expect(applied).toBe(2); // 3 -> 1, not the full 5
      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 1 });
    });

    test("floors Health at 1 when a nearby ally holds the Perk", async () => {
      const actor = makeActor({ health: 3 });
      canvas.tokens.placeables = [makeAllyToken()];

      await applyDamage(actor, 5, 'sharp');

      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 1 });
    });

    test("doesn't apply without the Perk, on the actor or any nearby ally", async () => {
      const actor = makeActor({ health: 3 });
      canvas.tokens.placeables = [makeAllyToken({ hasPerk: false })];

      await applyDamage(actor, 5, 'sharp');

      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
    });

    test("doesn't apply to an enemy holding the Perk", async () => {
      const actor = makeActor({ health: 3 });
      canvas.tokens.placeables = [makeAllyToken({ disposition: -1 })];

      await applyDamage(actor, 5, 'sharp');

      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
    });

    test("doesn't apply when Health doesn't actually reach 0", async () => {
      const actor = makeActor({ health: 10, hasPerk: true });

      await applyDamage(actor, 5, 'sharp');

      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
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
