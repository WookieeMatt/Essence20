import { jest } from '@jest/globals';
import { _powerCountUpdate, powerCost } from "./power-handler.mjs";

const SPEED_BOOST_ID = "Compendium.essence20.pr_crb.Item.CDbaCheOK2rUsqli";

function makeActor(personalValue) {
  return {
    update: jest.fn(),
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

function makeEffect(disabled) {
  return { disabled, update: jest.fn(async function (data) {
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
    expect(ground.disabled).toBe(false);
  });

  test("does not dispatch when the spend is rejected (unaffordable)", async () => {
    const actor = makeActor(3);
    const ground = makeEffect(true);
    const power = { name: 'Speed Boost', flags: { core: { sourceId: SPEED_BOOST_ID } }, effects: makeEffectsCollection([ground]) };

    await _powerCountUpdate(actor, 10, 'personal', 5, power);

    expect(ground.disabled).toBe(true);
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
    expect(ground.disabled).toBe(false);
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
    expect(ground.disabled).toBe(true);
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

    expect(ground.disabled).toBe(false);
  });

  test("free-to-activate threat Power (no cost): the dedicated free-activation branch dispatches to onPowerUse with nothing to spend", async () => {
    const ground = makeEffect(true);
    const actor = { update: jest.fn(), system: { powers: { threat: {} } } };
    const power = {
      name: 'Speed Boost',
      flags: { core: { sourceId: SPEED_BOOST_ID } },
      effects: makeEffectsCollection([ground]),
      system: { type: 'threat', hasVariableCost: false, powerCost: null },
    };

    await powerCost(actor, power);

    expect(actor.update).not.toHaveBeenCalled();
    expect(ground.disabled).toBe(false);
  });
});
