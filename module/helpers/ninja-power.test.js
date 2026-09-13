import { jest } from '@jest/globals';
import { isNinjaPowerActive, toggleNinjaPower } from './ninja-power.mjs';

function makeActor({ active = false, power = 1 } = {}) {
  const flagStore = { ninjaPowerActive: active };
  return {
    system: { powers: { personal: { value: power } } },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    update: jest.fn(async ({ 'system.powers.personal.value': value }) => {
      if (value !== undefined) {
        power = value;
      }
    }),
  };
}

describe("isNinjaPowerActive / toggleNinjaPower", () => {
  test("switches on, spending 1 Power", async () => {
    const actor = makeActor({ active: false, power: 1 });
    expect(isNinjaPowerActive(actor)).toBe(false);

    const result = await toggleNinjaPower(actor);

    expect(result).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(isNinjaPowerActive(actor)).toBe(true);
  });

  test("switches off for free", async () => {
    const actor = makeActor({ active: true });

    const result = await toggleNinjaPower(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'ninjaPowerActive', false);
  });

  test("returns null without spending anything if unaffordable", async () => {
    const actor = makeActor({ active: false, power: 0 });

    const result = await toggleNinjaPower(actor);

    expect(result).toBeNull();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
