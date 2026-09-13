import { jest } from '@jest/globals';
import { isAugmentedCombatActive, toggleAugmentedCombat } from './augmented-combat.mjs';

function makeActor({ active = false } = {}) {
  const flagStore = { augmentedCombatActive: active };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isAugmentedCombatActive", () => {
  test("false by default", () => {
    expect(isAugmentedCombatActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isAugmentedCombatActive(makeActor({ active: true }))).toBe(true);
  });
});

describe("toggleAugmentedCombat", () => {
  test("switches on from off", async () => {
    const actor = makeActor({ active: false });
    expect(await toggleAugmentedCombat(actor)).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'augmentedCombatActive', true);
  });

  test("switches off from on", async () => {
    const actor = makeActor({ active: true });
    expect(await toggleAugmentedCombat(actor)).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'augmentedCombatActive', false);
  });
});
