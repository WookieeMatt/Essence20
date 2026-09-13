import { jest } from '@jest/globals';
import { isDistractionActive, toggleDistraction } from './distraction.mjs';

function makeActor({ active = false, isMorphed = true, monsterForm = false } = {}) {
  const flagStore = { distractionActive: active };
  if (monsterForm) {
    flagStore.monsterFormActive = true;
  }

  return {
    system: { isMorphed },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isDistractionActive", () => {
  test("false by default", () => {
    expect(isDistractionActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isDistractionActive(makeActor({ active: true }))).toBe(true);
  });
});

describe("toggleDistraction", () => {
  test("activates while Morphed and not in Monster Form", async () => {
    const actor = makeActor({ active: false, isMorphed: true, monsterForm: false });
    const result = await toggleDistraction(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'distractionActive', true);
  });

  test("returns null when not Morphed", async () => {
    const actor = makeActor({ active: false, isMorphed: false });
    const result = await toggleDistraction(actor);

    expect(result).toBeNull();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("returns null while in Monster Form", async () => {
    const actor = makeActor({ active: false, isMorphed: true, monsterForm: true });
    const result = await toggleDistraction(actor);

    expect(result).toBeNull();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("deactivates for free, even without Morphed", async () => {
    const actor = makeActor({ active: true, isMorphed: false });
    const result = await toggleDistraction(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'distractionActive', false);
  });
});
