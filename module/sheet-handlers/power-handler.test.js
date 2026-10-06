import { jest } from '@jest/globals';
// The dispatch probe: onPowerUse fires the Power's own powerUsed rules (rules/plugins/resources/power-used.mjs).
const firePowerUsed = jest.fn(async () => {});
jest.unstable_mockModule('./rules/plugins/resources/power-used.mjs', () => ({ firePowerUsed, ruleUseIsFree: () => false }));
const { _powerCountUpdate, fixedPowerCost, powerCost } = await import("./power-handler.mjs");

beforeEach(() => firePowerUsed.mockClear());

const SPEED_BOOST_ID = "Compendium.essence20.pr_crb.Item.CDbaCheOK2rUsqli";

function makeActor(personalValue) {
  return {
    update: jest.fn(),
    getFlag: jest.fn(),
    setFlag: jest.fn(),
    system: { powers: { personal: { value: personalValue } } },
  };
}

function makeEffectsCollection(effects) {
  return {
    size: effects.length,
    every: fn => effects.every(fn),
    [Symbol.iterator]: () => effects[Symbol.iterator](),
  };
}

// A Speed Boost-shaped Power; the dispatch itself is observed through firePowerUsed.
function makeEffect(disabled) {
  return { disabled, changes: [{ key: 'system.movement.ground.morphed' }], update: jest.fn(async function (data) {
    this.disabled = data.disabled;
  }) };
}

describe("_powerCountUpdate", () => {
  beforeEach(() => {
    global.ui.notifications.error.mockClear();
  });

  test("errors and doesn't update when the cost exceeds the power's max", () => {
    const actor = makeActor(10);
    _powerCountUpdate(actor, 5, 'personal', 8);
    expect(global.ui.notifications.error).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("errors and doesn't update when the cost exceeds the actor's current value (non-threat)", () => {
    const actor = makeActor(3);
    _powerCountUpdate(actor, 10, 'personal', 5);
    expect(global.ui.notifications.error).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("deducts the cost from the power's value when affordable", () => {
    const actor = makeActor(10);
    _powerCountUpdate(actor, 20, 'personal', 4);
    expect(global.ui.notifications.error).not.toHaveBeenCalled();
    expect(actor.update).toHaveBeenCalledWith({ "system.powers.personal.value": 6 });
  });

  test("floors the deduction at 0", () => {
    const actor = makeActor(3);
    _powerCountUpdate(actor, 20, 'personal', 3);
    expect(actor.update).toHaveBeenCalledWith({ "system.powers.personal.value": 0 });
  });

  test("threat power type skips the current-value check and is never deducted", () => {
    const actor = { update: jest.fn(), system: { powers: { threat: {} } } };
    _powerCountUpdate(actor, 20, 'threat', 15); // within max, so the threat-only value check is what's being exercised
    expect(global.ui.notifications.error).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("threat power type still errors when the cost exceeds max", () => {
    const actor = { update: jest.fn(), system: { powers: { threat: {} } } };
    _powerCountUpdate(actor, 20, 'threat', 25);
    expect(global.ui.notifications.error).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("dispatches to the Power's own onPowerUse handler once the cost is actually spent", async () => {
    const actor = makeActor(10);
    const ground = makeEffect(true);
    const power = { name: 'Speed Boost', flags: { core: { sourceId: SPEED_BOOST_ID } }, effects: makeEffectsCollection([ground]) };

    await _powerCountUpdate(actor, 20, 'personal', 4, power);

    expect(actor.update).toHaveBeenCalledWith({ "system.powers.personal.value": 6 });
    expect(firePowerUsed).toHaveBeenCalledWith(actor, power, expect.any(Number));
  });

  test("does not dispatch when the spend is rejected (unaffordable)", async () => {
    const actor = makeActor(3);
    const ground = makeEffect(true);
    const power = { name: 'Speed Boost', flags: { core: { sourceId: SPEED_BOOST_ID } }, effects: makeEffectsCollection([ground]) };

    await _powerCountUpdate(actor, 10, 'personal', 5, power);

    expect(firePowerUsed).not.toHaveBeenCalled();
  });
});

describe("powerCost", () => {
  beforeEach(() => {
    global.ui.notifications.error.mockClear();
  });

  test("fixed-cost path: spends the cost, then dispatches to onPowerUse", async () => {
    const actor = makeActor(5);
    const ground = makeEffect(true);
    const power = {
      name: 'Speed Boost',
      flags: { core: { sourceId: SPEED_BOOST_ID } },
      effects: makeEffectsCollection([ground]),
      system: { type: 'grid', hasVariableCost: false, powerCost: 1 },
    };

    await powerCost(actor, power);

    expect(actor.update).toHaveBeenCalledWith({ "system.powers.personal.value": 4 });
    expect(firePowerUsed).toHaveBeenCalledWith(actor, power, expect.any(Number));
  });

  // G.I. Joe nanomite powers: no Power points, two uses a day (mechanics/resources/nanomite-uses.mjs).
  test("a nanomite power spends a daily use, never Power points", async () => {
    const actor = makeActor(5);
    actor.items = [];
    const power = {
      name: 'Repair Machine',
      flags: {},
      effects: makeEffectsCollection([]),
      system: { type: 'nanomite', usesPer: 2, usesInterval: 'perDay', usesSpent: 0, powerCost: null },
      update: jest.fn(),
    };

    await powerCost(actor, power);

    expect(power.update).toHaveBeenCalledWith({ 'system.usesSpent': 1 });
    expect(actor.update).not.toHaveBeenCalled();
  });

  // A Zord or vehicle has no Power pool; used through a chosen crew member, the member pays.
  test("a crew member pays for a Power on a Zord or vehicle", async () => {
    const zord = { name: 'Zord', update: jest.fn(), getFlag: jest.fn(), setFlag: jest.fn(), system: {} };
    const pilot = makeActor(3);
    const power = {
      name: 'Speed Boost',
      flags: { core: { sourceId: SPEED_BOOST_ID } },
      effects: makeEffectsCollection([makeEffect(true)]),
      system: { type: 'grid', hasVariableCost: false, powerCost: 1 },
    };

    await powerCost(zord, power, pilot);

    expect(pilot.update).toHaveBeenCalledWith({ "system.powers.personal.value": 2 });
    expect(zord.update).not.toHaveBeenCalled();
  });

  test("warns instead of throwing when nobody in the roll has a Power pool", async () => {
    global.ui.notifications.warn.mockClear();
    const vehicle = { name: 'Glider', update: jest.fn(), system: {} };
    const power = { name: 'Boost', effects: makeEffectsCollection([]), system: { type: 'grid', hasVariableCost: false, powerCost: 1 } };

    await expect(powerCost(vehicle, power)).resolves.toBeUndefined();
    expect(global.ui.notifications.warn).toHaveBeenCalled();
    expect(vehicle.update).not.toHaveBeenCalled();
  });

  test("fixed-cost path: neither spends nor dispatches when unaffordable", async () => {
    const actor = makeActor(0);
    const ground = makeEffect(true);
    const power = {
      name: 'Speed Boost',
      flags: { core: { sourceId: SPEED_BOOST_ID } },
      effects: makeEffectsCollection([ground]),
      system: { type: 'grid', hasVariableCost: false, powerCost: 1 },
    };

    await powerCost(actor, power);

    expect(actor.update).not.toHaveBeenCalled();
    expect(firePowerUsed).not.toHaveBeenCalled();
    expect(global.ui.notifications.error).toHaveBeenCalled();
  });

  test("free-to-activate grid Power (no cost): still dispatches to onPowerUse (a null cost numerically satisfies the affordability check, so this goes through the same spend-then-dispatch branch as a real cost, spending 0)", async () => {
    const actor = makeActor(0);
    const ground = makeEffect(true);
    const power = {
      name: 'Speed Boost',
      flags: { core: { sourceId: SPEED_BOOST_ID } },
      effects: makeEffectsCollection([ground]),
      system: { type: 'grid', hasVariableCost: false, powerCost: null },
    };

    await powerCost(actor, power);

    expect(firePowerUsed).toHaveBeenCalledWith(actor, power, expect.any(Number));
  });

  test("free-to-activate threat Power (no cost): the dedicated free-activation branch dispatches to onPowerUse with nothing to spend", async () => {
    const ground = makeEffect(true);
    const actor = { update: jest.fn(), getFlag: jest.fn(), setFlag: jest.fn(), system: { powers: { threat: {} } } };
    const power = {
      name: 'Speed Boost',
      flags: { core: { sourceId: SPEED_BOOST_ID } },
      effects: makeEffectsCollection([ground]),
      system: { type: 'threat', hasVariableCost: false, powerCost: null },
    };

    await powerCost(actor, power);

    expect(actor.update).not.toHaveBeenCalled();
    expect(firePowerUsed).toHaveBeenCalledWith(actor, power, expect.any(Number));
  });

  // USER DECISION (2026-09-24): Sorcerous points (Finster's Monster-Matic Cookbook p.274) are a
  // one-time BUILD budget spent when the Power is created, not a per-activation pool - see
  // documents/actor.mjs#_prepareSorcerousPower's own committed/max tracking of that same budget.
  describe("sorcerous Power type", () => {
    function makeSorcerousActor(sorcerousValue = 0) {
      return {
        update: jest.fn(),
        getFlag: jest.fn(),
        setFlag: jest.fn(),
        system: { powers: { sorcerous: { value: sorcerousValue } } },
      };
    }

    test("never spends system.powers.sorcerous.value, but still dispatches to onPowerUse", async () => {
      const actor = makeSorcerousActor(0);
      const ground = makeEffect(true);
      const power = {
        name: 'Speed Boost',
        flags: { core: { sourceId: SPEED_BOOST_ID } },
        effects: makeEffectsCollection([ground]),
        system: { type: 'sorcerous', hasVariableCost: false, powerCost: 3 },
      };

      await powerCost(actor, power);

      expect(actor.update).not.toHaveBeenCalled();
      expect(firePowerUsed).toHaveBeenCalledWith(actor, power, expect.any(Number));
    });

    test("dispatches even when the actor's sorcerous value is 0 - powerCost is a build cost, not an affordability check", async () => {
      const actor = makeSorcerousActor(0);
      const ground = makeEffect(true);
      const power = {
        name: 'Speed Boost',
        flags: { core: { sourceId: SPEED_BOOST_ID } },
        effects: makeEffectsCollection([ground]),
        system: { type: 'sorcerous', hasVariableCost: false, powerCost: 10 },
      };

      await powerCost(actor, power);

      expect(global.ui.notifications.error).not.toHaveBeenCalled();
      expect(firePowerUsed).toHaveBeenCalledWith(actor, power, expect.any(Number));
    });

    test("ignores hasVariableCost - never opens the PowerCostSelector spend flow", async () => {
      const actor = makeSorcerousActor(0);
      const ground = makeEffect(true);
      const power = {
        name: 'Speed Boost',
        flags: { core: { sourceId: SPEED_BOOST_ID } },
        effects: makeEffectsCollection([ground]),
        system: { type: 'sorcerous', hasVariableCost: true, maxPowerCost: 5, powerCost: 3 },
      };

      await powerCost(actor, power);

      expect(actor.update).not.toHaveBeenCalled();
      expect(firePowerUsed).toHaveBeenCalledWith(actor, power, expect.any(Number));
    });
  });
});

describe("fixedPowerCost", () => {
  // Zeo Crystal Wielder's discount is an ItemModifier rule on the derived powerCost (rules/conv14-other.test.js).
  test("is the Power's (derived) cost, 0 when unset", () => {
    expect(fixedPowerCost({ items: [] }, { system: { powerCost: 2 } })).toBe(2);
    expect(fixedPowerCost({ items: [] }, { system: { powerCost: '1' } })).toBe(1);
    expect(fixedPowerCost({ items: [] }, { system: { powerCost: null } })).toBe(0);
  });
});
