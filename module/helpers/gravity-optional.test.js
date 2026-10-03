import { jest } from '@jest/globals';
import { isGravityOptionalActive, toggleGravityOptional } from './gravity-optional.mjs';

global.game = { combat: null };

function makeActor({ active = false, usedFlag = undefined, level = 1 } = {}) {
  const flags = { gravityOptionalActive: active };
  if (usedFlag !== undefined) {
    flags.gravityOptionalUsedThisEncounter = usedFlag;
  }

  return {
    system: { level },
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value; 
    }),
  };
}

describe("isGravityOptionalActive", () => {
  test("true when the flag is set", () => {
    expect(isGravityOptionalActive(makeActor({ active: true }))).toBe(true);
  });

  test("false when the flag is unset", () => {
    expect(isGravityOptionalActive(makeActor({ active: false }))).toBe(false);
  });
});

describe("toggleGravityOptional", () => {
  beforeEach(() => {
    global.game = { combat: { id: 'combat1' } };
  });

  test("turns on and marks the scene used, when not yet used", async () => {
    const actor = makeActor({ active: false });
    const result = await toggleGravityOptional(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'gravityOptionalActive', true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'gravityOptionalUsedThisEncounter', { epoch: 1, window: 'encounter', count: 1 });
  });

  test("returns null and changes nothing when already used this scene", async () => {
    const actor = makeActor({ active: false, usedFlag: { epoch: 1, window: 'encounter', count: 1 } });
    const result = await toggleGravityOptional(actor);

    expect(result).toBe(null);
    expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'gravityOptionalActive', expect.anything());
  });

  test("turns back off for free, even if already used this scene", async () => {
    const actor = makeActor({ active: true, usedFlag: { epoch: 1, window: 'encounter', count: 1 } });
    const result = await toggleGravityOptional(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'gravityOptionalActive', false);
  });
});
