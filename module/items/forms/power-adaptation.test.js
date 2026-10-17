import { jest } from '@jest/globals';
import { healRegeneratingShellAtTurnEnd, isPowerAdaptationActive } from './power-adaptation.mjs';

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
