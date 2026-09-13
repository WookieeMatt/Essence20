import { jest } from '@jest/globals';
import { addToxicTerrorStack, getToxicTerrorShiftDown, isToxicTerrorActive, toggleToxicTerror } from './toxic-terror.mjs';

function makeActor({ active = false, power = 1 } = {}) {
  const flagStore = { toxicTerrorActive: active };
  return {
    system: { powers: { personal: { value: power } } },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    update: jest.fn(),
  };
}

describe("isToxicTerrorActive", () => {
  test("false by default", () => {
    expect(isToxicTerrorActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isToxicTerrorActive(makeActor({ active: true }))).toBe(true);
  });
});

describe("toggleToxicTerror", () => {
  test("activates and spends 1 Personal Power", async () => {
    const actor = makeActor({ active: false, power: 1 });
    const result = await toggleToxicTerror(actor);

    expect(result).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'toxicTerrorActive', true);
  });

  test("returns null and spends nothing when unaffordable", async () => {
    const actor = makeActor({ active: false, power: 0 });
    const result = await toggleToxicTerror(actor);

    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("deactivates for free", async () => {
    const actor = makeActor({ active: true, power: 0 });
    const result = await toggleToxicTerror(actor);

    expect(result).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'toxicTerrorActive', false);
  });
});

describe("addToxicTerrorStack / getToxicTerrorShiftDown", () => {
  function makeTargetActor({ stacks = 0 } = {}) {
    const flagStore = { toxicTerrorStacks: stacks };
    return {
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
    };
  }

  test("0 with no stacks", () => {
    expect(getToxicTerrorShiftDown(makeTargetActor())).toBe(0);
  });

  test("adding a stack increments the count", async () => {
    const target = makeTargetActor({ stacks: 1 });
    await addToxicTerrorStack(target);

    expect(target.setFlag).toHaveBeenCalledWith('essence20', 'toxicTerrorStacks', 2);
  });
});
