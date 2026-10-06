import { jest } from '@jest/globals';
import { healRegeneratingShellAtTurnEnd, isPowerAdaptationActive, togglePowerAdaptation } from './power-adaptation.mjs';

function makeActor({ active = {}, power = 2, health = 5, healthMax = 10 } = {}) {
  const flagStore = { powerAdaptationActive: active };
  return {
    system: { powers: { personal: { value: power } }, health: { value: health, max: healthMax } },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    update: jest.fn(),
  };
}

describe("isPowerAdaptationActive", () => {
  test("false by default", () => {
    expect(isPowerAdaptationActive(makeActor(), 'boostOfSpeed')).toBe(false);
  });

  test("true once that option's own flag is set", () => {
    const actor = makeActor({ active: { boostOfSpeed: true } });
    expect(isPowerAdaptationActive(actor, 'boostOfSpeed')).toBe(true);
    expect(isPowerAdaptationActive(actor, 'crushingStrength')).toBe(false);
  });
});

describe("togglePowerAdaptation", () => {
  test("activates a 1-Power option and spends it", async () => {
    const actor = makeActor({ power: 1 });
    const result = await togglePowerAdaptation(actor, 'boostOfSpeed');

    expect(result).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'powerAdaptationActive', expect.objectContaining({ boostOfSpeed: true }),
    );
  });

  test("activates a 2-Power option and spends it", async () => {
    const actor = makeActor({ power: 2 });
    const result = await togglePowerAdaptation(actor, 'fastTrigger');

    expect(result).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
  });

  test("returns null and spends nothing when the actor can't afford activation", async () => {
    const actor = makeActor({ power: 0 });
    const result = await togglePowerAdaptation(actor, 'boostOfSpeed');

    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("deactivates for free, spending nothing", async () => {
    const actor = makeActor({ active: { boostOfSpeed: true }, power: 0 });
    const result = await togglePowerAdaptation(actor, 'boostOfSpeed');

    expect(result).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'powerAdaptationActive', expect.objectContaining({ boostOfSpeed: false }),
    );
  });

  test("preserves other already-active options untouched", async () => {
    const actor = makeActor({ active: { crushingStrength: true }, power: 1 });
    await togglePowerAdaptation(actor, 'boostOfSpeed');

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'powerAdaptationActive', { crushingStrength: true, boostOfSpeed: true },
    );
  });
});

describe("healRegeneratingShellAtTurnEnd", () => {
  test("heals 1 Health while active", async () => {
    const actor = makeActor({ active: { regeneratingShell: true }, health: 5, healthMax: 10 });
    await healRegeneratingShellAtTurnEnd(actor);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 6 });
  });

  test("does nothing while inactive", async () => {
    const actor = makeActor({ health: 5, healthMax: 10 });
    await healRegeneratingShellAtTurnEnd(actor);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("doesn't overheal past max Health", async () => {
    const actor = makeActor({ active: { regeneratingShell: true }, health: 10, healthMax: 10 });
    await healRegeneratingShellAtTurnEnd(actor);
    expect(actor.update).not.toHaveBeenCalled();
  });
});
