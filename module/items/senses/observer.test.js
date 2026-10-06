import { jest } from '@jest/globals';
import { isObserverDisguiseActive, toggleObserverDisguise } from './observer.mjs';

function makeActor({ power = 1, active = false } = {}) {
  return {
    system: { powers: { personal: { value: power } } },
    update: jest.fn(),
    getFlag: jest.fn(() => active),
    setFlag: jest.fn(),
  };
}

describe("isObserverDisguiseActive", () => {
  test("reflects the stored flag", () => {
    expect(isObserverDisguiseActive(makeActor({ active: true }))).toBe(true);
    expect(isObserverDisguiseActive(makeActor({ active: false }))).toBe(false);
  });
});

describe("toggleObserverDisguise", () => {
  test("switching ON spends 1 Power", async () => {
    const actor = makeActor({ power: 1, active: false });
    const result = await toggleObserverDisguise(actor);

    expect(result).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'observerDisguiseActive', true);
  });

  test("returns null and spends nothing when unaffordable", async () => {
    const actor = makeActor({ power: 0, active: false });
    const result = await toggleObserverDisguise(actor);

    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("switching back OFF is free", async () => {
    const actor = makeActor({ power: 0, active: true });
    const result = await toggleObserverDisguise(actor);

    expect(result).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'observerDisguiseActive', false);
  });
});
