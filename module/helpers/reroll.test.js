import { jest } from '@jest/globals';

import {
  applyReroll,
  canMeetRerollCondition,
  canMeetRerollScope,
  canUseReroll,
  consumeRerollUsage,
  getRerollConfigs,
  hasEligibleRerollTarget,
  hasRerollCost,
  payRerollCost,
  rerollModeLabel,
} from './reroll.mjs';

function makeActor({ flags = {}, system = {}, items = { documentsByType: { rolePoints: [] } } } = {}) {
  const store = { essence20: { ...flags } };
  return {
    system,
    items,
    update: jest.fn(async (changes) => changes),
    getFlag: jest.fn((scope, key) => store[scope]?.[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      store[scope] ??= {};
      store[scope][key] = value;
    }),
  };
}

function makeDie(faces, results) {
  return {
    faces,
    results: results.map(r => ({ ...r })),
    reroll: jest.fn(async () => {}),
    roll: jest.fn(async function () {
      this.results.push({ result: 9, active: true });
    }),
  };
}

function makeRoll(dice) {
  return {
    dice,
    _evaluateTotal: jest.fn(() => 42),
  };
}

/* getRerollConfigs */
describe("getRerollConfigs", () => {
  test("returns nothing for an actor with no reroll grants", () => {
    const actor = makeActor();
    actor.items = [];
    actor.effects = [];
    expect(getRerollConfigs(actor)).toEqual([]);
  });

  test("reads a Perk's own system.reroll schema", () => {
    const actor = makeActor();
    actor.items = [{
      uuid: "Item.abc",
      system: { reroll: { enabled: true, mode: "ones", target: "allDice" } },
    }];
    actor.effects = [];

    const configs = getRerollConfigs(actor);
    expect(configs).toHaveLength(1);
    expect(configs[0]).toMatchObject({ mode: "ones", target: "allDice", source: "Item.abc", sourceType: "item" });
  });

  test("ignores a disabled reroll grant", () => {
    const actor = makeActor();
    actor.items = [{ uuid: "Item.abc", system: { reroll: { enabled: false } } }];
    actor.effects = [];
    expect(getRerollConfigs(actor)).toEqual([]);
  });

  test("Power Infusion's advances.type 'rerolls' falls back to an accumulated values list, reset 'scene'", () => {
    const actor = makeActor();
    actor.items = [{
      uuid: "Item.powerInfusion",
      name: "Power Infusion",
      system: { advances: { type: "rerolls", baseValue: 1, currentValue: 2 } },
    }];
    actor.effects = [];

    const configs = getRerollConfigs(actor);
    expect(configs).toHaveLength(1);
    // 18th-level Power Infusion ("...and 2s") should still reroll 1s, not just 2s.
    expect(configs[0].values).toEqual([1, 2]);
    expect(configs[0].reset).toBe("scene");
  });

  test("reads a reroll grant off an ActiveEffect", () => {
    const actor = makeActor();
    actor.items = [];
    actor.effects = [{ id: "eff1", system: { reroll: { enabled: true, mode: "all" } } }];

    const configs = getRerollConfigs(actor);
    expect(configs).toHaveLength(1);
    expect(configs[0]).toMatchObject({ sourceType: "effect", source: "eff1" });
  });
});

/* canUseReroll / consumeRerollUsage */
describe("canUseReroll / consumeRerollUsage", () => {
  test("allows use under maxUses, and blocks once exhausted", async () => {
    const actor = makeActor();
    const config = { maxUses: 1, reset: "none" };

    expect(await canUseReroll(actor, config, "item:x")).toBe(true);
    await consumeRerollUsage(actor, config, "item:x");
    expect(await canUseReroll(actor, config, "item:x")).toBe(false);
  });

  test("a maxUses of 0 means unlimited use, never exhausted", async () => {
    const actor = makeActor();
    const config = { maxUses: 0, reset: "none" };

    expect(await canUseReroll(actor, config, "item:x")).toBe(true);
    await consumeRerollUsage(actor, config, "item:x");
    await consumeRerollUsage(actor, config, "item:x");
    expect(await canUseReroll(actor, config, "item:x")).toBe(true);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("a 'scene' reset bucket is independent per scene", async () => {
    global.game.scenes = { current: { id: "scene-1" } };
    const actor = makeActor();
    const config = { maxUses: 1, reset: "scene" };

    await consumeRerollUsage(actor, config, "item:x");
    expect(await canUseReroll(actor, config, "item:x")).toBe(false);

    global.game.scenes = { current: { id: "scene-2" } };
    expect(await canUseReroll(actor, config, "item:x")).toBe(true);

    delete global.game.scenes;
  });

  test("a 'combat' reset bucket is independent per Combat encounter (GI Joe CRB 'In My Sights')", async () => {
    global.game.combat = { id: "combat-1" };
    const actor = makeActor();
    const config = { maxUses: 1, reset: "combat" };

    await consumeRerollUsage(actor, config, "item:x");
    expect(await canUseReroll(actor, config, "item:x")).toBe(false);

    global.game.combat = { id: "combat-2" };
    expect(await canUseReroll(actor, config, "item:x")).toBe(true);

    delete global.game.combat;
  });
});

/* hasRerollCost / payRerollCost */
describe("hasRerollCost / payRerollCost", () => {
  test("no resourcePath configured means no cost to check", () => {
    const actor = makeActor({ system: {} });
    expect(hasRerollCost(actor, { cost: { resourcePath: "", amount: 0 } })).toBe(true);
  });

  test("insufficient resource is reported and not paid", async () => {
    const actor = makeActor({ system: { powers: { personal: { value: 0 } } } });
    const config = { cost: { resourcePath: "system.powers.personal.value", amount: 1 } };

    expect(hasRerollCost(actor, config)).toBe(false);
  });

  test("sufficient resource is deducted by the configured amount", async () => {
    const actor = makeActor({ system: { powers: { personal: { value: 3 } } } });
    const config = { cost: { resourcePath: "system.powers.personal.value", amount: 1 } };

    expect(hasRerollCost(actor, config)).toBe(true);
    await payRerollCost(actor, config);
    expect(actor.update).toHaveBeenCalledWith({ "system.powers.personal.value": 2 });
  });

  // MLP CRB "Cheer" - spends 1 use from the actor's own "Cheer Points" rolePoints Item (granted
  // by the Spirit of Laughter Role, see Compendium.essence20.mlp_crb.Item.3oTdxkJmm74S559r) rather
  // than a plain actor field, since that pool's level-scaling is already owned by the Item's own
  // system.resource.{value,max,increase,increaseLevels} - see rolePointsName's own doc comment on
  // reroll-schema.mjs.
  describe("a Role Points Item cost", () => {
    test("is unaffordable when there's no matching Role Points Item on the actor", () => {
      const actor = makeActor();
      expect(hasRerollCost(actor, { cost: { rolePointsName: "Cheer Points" } })).toBe(false);
    });

    test("is unaffordable when the Item's pool is empty", () => {
      const rolePoints = { name: "Cheer Points", system: { resource: { value: 0 }, powerCost: null } };
      const actor = makeActor({ items: { documentsByType: { rolePoints: [rolePoints] } } });
      expect(hasRerollCost(actor, { cost: { rolePointsName: "Cheer Points" } })).toBe(false);
    });

    test("is affordable when the pool has a point, and paying it deducts 1 from the Item", async () => {
      const rolePoints = {
        name: "Cheer Points",
        system: { resource: { value: 2 }, powerCost: null },
        update: jest.fn(async (changes) => changes),
      };
      const actor = makeActor({ items: { documentsByType: { rolePoints: [rolePoints] } } });
      const config = { cost: { rolePointsName: "Cheer Points" } };

      expect(hasRerollCost(actor, config)).toBe(true);
      await payRerollCost(actor, config);
      expect(rolePoints.update).toHaveBeenCalledWith({ "system.resource.value": 1 });
    });

    test("an unlimited-resource actor can afford it, and paying it never touches the Item", async () => {
      const rolePoints = {
        name: "Cheer Points",
        system: { resource: { value: 0 }, powerCost: null },
        update: jest.fn(),
      };
      const actor = makeActor({
        system: { useUnlimitedResource: true },
        items: { documentsByType: { rolePoints: [rolePoints] } },
      });
      const config = { cost: { rolePointsName: "Cheer Points" } };

      expect(hasRerollCost(actor, config)).toBe(true);
      await payRerollCost(actor, config);
      expect(rolePoints.update).not.toHaveBeenCalled();
    });
  });

  // GI Joe CRB "In My Sights" - a world-level Story Point cost, not an actor resource. See
  // helpers/story-points.mjs for why spending it needs a currently-connected GM's own client.
  describe("a world Story Point cost", () => {
    beforeEach(() => {
      global.game.users = [{ isGM: true, active: true }];
      global.game.socket = { emit: jest.fn() };
    });

    afterEach(() => {
      delete global.game.users;
      delete global.game.socket;
    });

    test("is unaffordable when no GM is connected, even with enough points", () => {
      global.game.users = [{ isGM: true, active: false }];
      global.game.settings.get = jest.fn(() => 5);
      const actor = makeActor();

      expect(hasRerollCost(actor, { cost: { worldStoryPoints: 1 } })).toBe(false);
    });

    test("is unaffordable when there aren't enough points, even with a GM connected", () => {
      global.game.settings.get = jest.fn(() => 0);
      const actor = makeActor();

      expect(hasRerollCost(actor, { cost: { worldStoryPoints: 1 } })).toBe(false);
    });

    test("is affordable with a connected GM and enough points, and paying it requests a spend", async () => {
      global.game.settings.get = jest.fn(() => 2);
      const actor = makeActor({ system: {} });
      actor.name = "Duke";
      const config = { cost: { worldStoryPoints: 1 } };

      expect(hasRerollCost(actor, config)).toBe(true);
      await payRerollCost(actor, config);
      expect(global.game.socket.emit).toHaveBeenCalledWith("system.essence20", {
        action: "spendStoryPoints",
        amount: 1,
        actorName: "Duke",
      });
    });
  });
});

/* canMeetRerollCondition */
describe("canMeetRerollCondition", () => {
  test("'none' is always met", () => {
    const actor = makeActor();
    expect(canMeetRerollCondition(actor, { condition: "none" })).toBe(true);
  });

  test("'morphed' requires system.isMorphed", () => {
    const morphed = makeActor({ system: { isMorphed: true } });
    const unmorphed = makeActor({ system: { isMorphed: false } });
    expect(canMeetRerollCondition(morphed, { condition: "morphed" })).toBe(true);
    expect(canMeetRerollCondition(unmorphed, { condition: "morphed" })).toBe(false);
  });

  test("'notSnagged' reads the triggering roll's own Snag state, not actor state", () => {
    const actor = makeActor();
    expect(canMeetRerollCondition(actor, { condition: "notSnagged" }, { snag: false })).toBe(true);
    expect(canMeetRerollCondition(actor, { condition: "notSnagged" }, { snag: true })).toBe(false);
    // No context at all (e.g. a flat roll with no {skill, essence, snag} flags) reads as unsnagged.
    expect(canMeetRerollCondition(actor, { condition: "notSnagged" })).toBe(true);
  });

  test("'rollFailed' requires the triggering roll to have actually failed", () => {
    const actor = makeActor();
    expect(canMeetRerollCondition(actor, { condition: "rollFailed" }, { rollFailed: true })).toBe(true);
    expect(canMeetRerollCondition(actor, { condition: "rollFailed" }, { rollFailed: false })).toBe(false);
    // No known outcome (e.g. a plain skill roll with nothing to fail against) reads as unmet,
    // not as an automatic pass.
    expect(canMeetRerollCondition(actor, { condition: "rollFailed" })).toBe(false);
  });

  test("'powerWeapon' requires the triggering roll to be a Power Weapon attack", () => {
    const actor = makeActor();
    expect(canMeetRerollCondition(actor, { condition: "powerWeapon" }, { isPowerWeaponAttack: true })).toBe(true);
    expect(canMeetRerollCondition(actor, { condition: "powerWeapon" }, { isPowerWeaponAttack: false })).toBe(false);
    expect(canMeetRerollCondition(actor, { condition: "powerWeapon" })).toBe(false);
  });
});

/* canMeetRerollScope */
describe("canMeetRerollScope", () => {
  test("an unscoped grant (no skills, essence 'any') matches anything", () => {
    expect(canMeetRerollScope({ skills: [], essence: "any" }, { skill: "athletics", essence: "strength" })).toBe(true);
    expect(canMeetRerollScope({ skills: [], essence: "any" }, {})).toBe(true);
  });

  test("a skill-scoped grant only matches its named skill(s)", () => {
    const config = { skills: ["alertness", "survival"], essence: "any" };
    expect(canMeetRerollScope(config, { skill: "survival" })).toBe(true);
    expect(canMeetRerollScope(config, { skill: "athletics" })).toBe(false);
  });

  test("an Essence-scoped grant only matches skills under that Essence", () => {
    const config = { skills: [], essence: "social" };
    expect(canMeetRerollScope(config, { essence: "social" })).toBe(true);
    expect(canMeetRerollScope(config, { essence: "strength" })).toBe(false);
  });
});

/* hasEligibleRerollTarget */
describe("hasEligibleRerollTarget", () => {
  test("mode 'ones' is eligible only when an active result actually shows a 1", () => {
    const config = { mode: "ones", target: "allDice", values: [] };
    const withOne = makeRoll([makeDie(20, [{ result: 1, active: true }])]);
    const withoutOne = makeRoll([makeDie(20, [{ result: 15, active: true }])]);

    expect(hasEligibleRerollTarget(withOne, config)).toBe(true);
    expect(hasEligibleRerollTarget(withoutOne, config)).toBe(false);
  });

  test("an inactive (already-dropped) matching result doesn't count", () => {
    const config = { mode: "ones", target: "allDice", values: [] };
    const roll = makeRoll([makeDie(20, [{ result: 1, active: false }])]);

    expect(hasEligibleRerollTarget(roll, config)).toBe(false);
  });

  test("a values-based grant is eligible only when one of those values is showing", () => {
    const config = { mode: "all", target: "allDice", values: [1, 2] };
    const matching = makeRoll([makeDie(20, [{ result: 2, active: true }])]);
    const notMatching = makeRoll([makeDie(20, [{ result: 10, active: true }])]);

    expect(hasEligibleRerollTarget(matching, config)).toBe(true);
    expect(hasEligibleRerollTarget(notMatching, config)).toBe(false);
  });

  test("an unconditional grant (mode 'all', no values) is eligible whenever a target die exists", () => {
    const config = { mode: "all", target: "allDice", values: [] };
    const roll = makeRoll([makeDie(20, [{ result: 17, active: true }])]);

    expect(hasEligibleRerollTarget(roll, config)).toBe(true);
  });

  test("no eligible dice at all (e.g. skillDice target on a die-less/d20-only roll) is ineligible", () => {
    const config = { mode: "ones", target: "skillDice", values: [] };
    const roll = makeRoll([makeDie(20, [{ result: 1, active: true }])]); // only the base d20 term

    expect(hasEligibleRerollTarget(roll, config)).toBe(false);
  });

  test("minDieFaces excludes a below-minimum die from eligibility too", () => {
    const config = { mode: "ones", target: "skillDice", values: [], minDieFaces: 4 };
    const roll = makeRoll([makeDie(2, [{ result: 1, active: true }])]);

    expect(hasEligibleRerollTarget(roll, config)).toBe(false);
  });
});

/* applyReroll */
describe("applyReroll", () => {
  test("mode 'ones' delegates to Die#reroll with the 'r1' modifier, recursively", async () => {
    const die = makeDie(20, [{ result: 1, active: true }]);
    const roll = makeRoll([die]);

    const success = await applyReroll(roll, { mode: "ones", target: "allDice", values: [] });

    expect(success).toBe(true);
    expect(die.reroll).toHaveBeenCalledWith("r1", { recursive: true });
    expect(roll._evaluateTotal).toHaveBeenCalled();
  });

  test("mode 'onesAndTwos' delegates to Die#reroll with a '<=2' comparison", async () => {
    const die = makeDie(20, [{ result: 2, active: true }]);
    const roll = makeRoll([die]);

    await applyReroll(roll, { mode: "onesAndTwos", target: "allDice", values: [] });

    expect(die.reroll).toHaveBeenCalledWith("r<=2", { recursive: true });
  });

  test("recursive: false (PR CRB 'Weapon Mastery') rerolls a matched result exactly once", async () => {
    const die = makeDie(20, [{ result: 2, active: true }]);
    const roll = makeRoll([die]);

    await applyReroll(roll, { mode: "onesAndTwos", target: "allDice", values: [], recursive: false });

    expect(die.reroll).toHaveBeenCalledWith("r<=2", { recursive: false });
  });

  test("an explicit values list issues one Die#reroll call per value", async () => {
    const die = makeDie(20, [{ result: 1, active: true }]);
    const roll = makeRoll([die]);

    await applyReroll(roll, { mode: "all", target: "allDice", values: [1, 2] });

    expect(die.reroll).toHaveBeenCalledWith("r1", { recursive: true });
    expect(die.reroll).toHaveBeenCalledWith("r2", { recursive: true });
  });

  test("mode 'all' with no values rerolls every active result unconditionally, in place", async () => {
    const die = makeDie(20, [{ result: 15, active: true }, { result: 3, active: true }]);
    const roll = makeRoll([die]);

    await applyReroll(roll, { mode: "all", target: "allDice", values: [] });

    expect(die.results[0]).toMatchObject({ active: false, rerolled: true });
    expect(die.results[1]).toMatchObject({ active: false, rerolled: true });
    expect(die.results).toHaveLength(4); // 2 original + 2 replacements pushed by die.roll()
    expect(die.reroll).not.toHaveBeenCalled();
  });

  test("minDieFaces excludes a below-minimum die (MLP/PR CRB 'Luck', d4 or higher)", async () => {
    const d2 = makeDie(2, [{ result: 1, active: true }]);
    const d6 = makeDie(6, [{ result: 1, active: true }]);
    const roll = makeRoll([d2, d6]);

    await applyReroll(roll, { mode: "ones", target: "skillDice", values: [], minDieFaces: 4 });

    expect(d2.reroll).not.toHaveBeenCalled();
    expect(d6.reroll).toHaveBeenCalledWith("r1", { recursive: true });
  });

  test("a Snagged d20 (2d20kl) reconsiders the untouched dropped result, not just the fresh reroll", async () => {
    // Snag keeps the LOWER of 2 results - kept 1 (bad), dropped 5. Rerolling the kept 1 (via
    // makeDie's mock, which always pushes a fresh 9) shouldn't just leave 9 as the total: 9 is
    // worse than the already-rolled, never-touched 5, so a correct "keep lower" should fall back
    // to that 5 instead.
    const die = makeDie(20, [{ result: 1, active: true }, { result: 5, active: false }]);
    const roll = makeRoll([die]);

    await applyReroll(roll, { mode: "all", target: "d20", values: [] });

    const active = die.results.filter(result => result.active);
    expect(active).toEqual([{ result: 5, active: true }]);
  });

  test("an Edge'd d20 (2d20kh) reconsiders the untouched dropped result too", async () => {
    // Edge keeps the HIGHER of 2 - kept 15, dropped 12. Rerolling the kept 15 down to a fresh 9
    // (makeDie's mock) shouldn't leave 9 as the total: the dropped 12 is still better.
    const die = makeDie(20, [{ result: 15, active: true }, { result: 12, active: false }]);
    const roll = makeRoll([die]);

    await applyReroll(roll, { mode: "all", target: "d20", values: [] });

    const active = die.results.filter(result => result.active);
    expect(active).toEqual([{ result: 12, active: true }]);
  });

  test("target 'skillDice' only touches d2-d12 dice - never the base d20 term", async () => {
    // E20.skillRollableShifts (helpers/config.mjs) tops out at d12; d20 is reserved for the base
    // roll term (including its Edge/Snag 2d20kh/2d20kl form), never a skill die.
    const skillDie = makeDie(12, [{ result: 1, active: true }]);
    const baseD20 = makeDie(20, [{ result: 1, active: true }]);
    const roll = makeRoll([skillDie, baseD20]);

    await applyReroll(roll, { mode: "ones", target: "skillDice", values: [] });

    expect(skillDie.reroll).toHaveBeenCalled();
    expect(baseD20.reroll).not.toHaveBeenCalled();
  });

  test("target 'd20' only touches the base d20 term, never a skill die", async () => {
    const skillDie = makeDie(8, [{ result: 1, active: true }]);
    const baseD20 = makeDie(20, [{ result: 1, active: true }]);
    const roll = makeRoll([skillDie, baseD20]);

    await applyReroll(roll, { mode: "ones", target: "d20", values: [] });

    expect(baseD20.reroll).toHaveBeenCalledWith("r1", { recursive: true });
    expect(skillDie.reroll).not.toHaveBeenCalled();
  });

  test("a single eligible die under target 'anyDie' rerolls it without prompting", async () => {
    const die = makeDie(20, [{ result: 15, active: true }]);
    const roll = makeRoll([die]);

    const success = await applyReroll(roll, { mode: "all", target: "anyDie", values: [] });

    expect(success).toBe(true);
    expect(die.results[0]).toMatchObject({ active: false, rerolled: true });
  });

  test("cancelling the die-picker dialog leaves the roll untouched and reports failure", async () => {
    const dieA = makeDie(20, [{ result: 15, active: true }]);
    const dieB = makeDie(20, [{ result: 3, active: true }]);
    const roll = makeRoll([dieA, dieB]);

    global.foundry.applications.api.DialogV2 = { wait: jest.fn(async () => "cancel") };
    const success = await applyReroll(roll, { mode: "single", target: "allDice", values: [] });

    expect(success).toBe(false);
    expect(dieA.results[0].active).toBe(true);
    expect(dieB.results[0].active).toBe(true);
    delete global.foundry.applications.api.DialogV2;
  });

  // A specialization roll's dice pool ("{1d2,1d4,1d6,1d8}kh") caches its own kept-result
  // snapshot separately from its member dice - these confirm that snapshot (and the roll's
  // total) actually catches up once one of the pool's own dice has been rerolled, rather than
  // silently going stale. See refreshPoolTerms's own doc comment in reroll.mjs for why.
  describe("dice pool ('kh'/'kl' specialization) totals", () => {
    function makeSubRoll(initialTotal, newTotal = initialTotal) {
      const subRoll = { _total: initialTotal, _evaluateTotal: jest.fn(() => newTotal), terms: [] };
      Object.defineProperty(subRoll, "total", { get: () => subRoll._total });
      return subRoll;
    }

    function makePool(rolls, results) {
      const pool = Object.assign(new foundry.dice.terms.PoolTerm(), { rolls, results });
      // Mirrors the real PoolTerm#total getter (client/dice/terms/pool.mjs) closely enough for
      // these tests: sum of active results.
      Object.defineProperty(pool, "total", {
        get: () => pool.results.filter(result => result.active).reduce((sum, result) => sum + result.result, 0),
      });
      return pool;
    }

    test("a nested die's reroll flips which pool member is kept (kh) and updates the total", async () => {
      // Matches the reported scenario: {1d2,1d4,1d6,1d8}kh, d4 (4) was the highest and kept;
      // the d8 (which showed a natural 1) gets rerolled up to 6, which should now be kept.
      const pool = makePool(
        [makeSubRoll(1), makeSubRoll(4), makeSubRoll(3), makeSubRoll(1, 6)],
        [
          { result: 1, active: false },
          { result: 4, active: true },
          { result: 3, active: false },
          { result: 1, active: false },
        ],
      );
      const roll = { dice: [], terms: [pool], _evaluateTotal: jest.fn(() => pool.total) };

      await applyReroll(roll, { mode: "all", target: "allDice", values: [] });

      expect(pool.results.filter(result => result.active)).toEqual([{ result: 6, active: true }]);
      expect(pool.total).toBe(6);
    });

    test("infers a 'keep lowest' pool from which results were active before, not just 'kh'", async () => {
      const pool = makePool(
        [makeSubRoll(2, 2), makeSubRoll(4), makeSubRoll(6)],
        [
          { result: 2, active: true }, // was the lowest, kept (kl)
          { result: 4, active: false },
          { result: 6, active: false },
        ],
      );
      const roll = { dice: [], terms: [pool], _evaluateTotal: jest.fn(() => pool.total) };

      await applyReroll(roll, { mode: "all", target: "allDice", values: [] });

      // Nothing changed value-wise, but the kept selection should still land on the lowest.
      expect(pool.results.filter(result => result.active)).toEqual([{ result: 2, active: true }]);
    });

    test("a roll with no dice pool at all is left alone", async () => {
      const die = makeDie(20, [{ result: 15, active: true }]);
      const roll = makeRoll([die]);
      roll.terms = [die];

      await expect(applyReroll(roll, { mode: "all", target: "allDice", values: [] })).resolves.toBe(true);
    });
  });
});

describe("rerollModeLabel", () => {
  test("falls back to 'All Dice' for an unknown mode", () => {
    expect(rerollModeLabel("something-unrecognized")).toBe("E20.RerollModeAll");
  });

  test("resolves a known mode", () => {
    expect(rerollModeLabel("ones")).toBe("E20.RerollModeOnes");
  });
});
