import { jest } from '@jest/globals';
import { isUnmovableActive, toggleUnmovable } from './unmovable.mjs';

function makeActor({ active = false, power = 1 } = {}) {
  const flags = { unmovableActive: active };
  return {
    system: { powers: { personal: { value: power } } },
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value; 
    }),
    update: jest.fn(async function (data) {
      this.system.powers.personal.value = data['system.powers.personal.value']; 
    }),
  };
}

describe("isUnmovableActive", () => {
  test("reflects the flag", () => {
    expect(isUnmovableActive(makeActor({ active: true }))).toBe(true);
    expect(isUnmovableActive(makeActor({ active: false }))).toBe(false);
  });
});

describe("toggleUnmovable", () => {
  test("turns on and spends 1 Personal Power when affordable", async () => {
    const actor = makeActor({ active: false, power: 1 });

    const result = await toggleUnmovable(actor);

    expect(result).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'unmovableActive', true);
  });

  test("returns null and spends nothing when unaffordable", async () => {
    const actor = makeActor({ active: false, power: 0 });

    const result = await toggleUnmovable(actor);

    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("turns back off for free", async () => {
    const actor = makeActor({ active: true, power: 0 });

    const result = await toggleUnmovable(actor);

    expect(result).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'unmovableActive', false);
  });
});
