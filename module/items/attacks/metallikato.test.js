import { jest } from '@jest/globals';
import { isMetallikatoMultipleTargetsActive, toggleMetallikatoMultipleTargets } from './metallikato.mjs';

function makeActor(active = false) {
  const flagStore = { metallikatoMultipleTargetsActive: active };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isMetallikatoMultipleTargetsActive", () => {
  test("reflects the actor's own flag", () => {
    expect(isMetallikatoMultipleTargetsActive(makeActor(true))).toBe(true);
    expect(isMetallikatoMultipleTargetsActive(makeActor(false))).toBe(false);
  });
});

describe("toggleMetallikatoMultipleTargets", () => {
  test("flips from off to on", async () => {
    const actor = makeActor(false);
    const result = await toggleMetallikatoMultipleTargets(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'metallikatoMultipleTargetsActive', true);
  });

  test("flips from on to off", async () => {
    const actor = makeActor(true);
    const result = await toggleMetallikatoMultipleTargets(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'metallikatoMultipleTargetsActive', false);
  });
});
