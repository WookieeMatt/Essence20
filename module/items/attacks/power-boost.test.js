import { jest } from '@jest/globals';
import { isPowerBoostActive, togglePowerBoost } from './power-boost.mjs';

function makeActor({ active = false, power = 2 } = {}) {
  const flagStore = { powerBoostActive: active };
  return {
    system: { powers: { personal: { value: power } } },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    update: jest.fn(),
  };
}

describe("isPowerBoostActive", () => {
  test("false by default", () => {
    expect(isPowerBoostActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isPowerBoostActive(makeActor({ active: true }))).toBe(true);
  });
});

describe("togglePowerBoost", () => {
  test("activates and spends 2 Personal Power when the actor can afford it", async () => {
    const actor = makeActor({ active: false, power: 2 });
    const result = await togglePowerBoost(actor);

    expect(result).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'powerBoostActive', true);
  });

  test("returns null and spends nothing when the actor can't afford activation", async () => {
    const actor = makeActor({ active: false, power: 1 });
    const result = await togglePowerBoost(actor);

    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("deactivates for free, spending nothing", async () => {
    const actor = makeActor({ active: true, power: 0 });
    const result = await togglePowerBoost(actor);

    expect(result).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'powerBoostActive', false);
  });
});
