import { jest } from '@jest/globals';
import { getGravityOptionalHeight, isGravityOptionalActive, toggleGravityOptional } from './gravity-optional.mjs';

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

describe("getGravityOptionalHeight", () => {
  test("5 feet at level 1", () => {
    expect(getGravityOptionalHeight(makeActor({ level: 1 }))).toBe(5);
  });

  test("10 feet at level 5", () => {
    expect(getGravityOptionalHeight(makeActor({ level: 5 }))).toBe(10);
  });

  test("15 feet at level 12", () => {
    expect(getGravityOptionalHeight(makeActor({ level: 12 }))).toBe(15);
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
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'gravityOptionalUsedThisEncounter', { combatId: 'combat1' });
  });

  test("returns null and changes nothing when already used this scene", async () => {
    const actor = makeActor({ active: false, usedFlag: { combatId: 'combat1' } });
    const result = await toggleGravityOptional(actor);

    expect(result).toBe(null);
    expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'gravityOptionalActive', expect.anything());
  });

  test("turns back off for free, even if already used this scene", async () => {
    const actor = makeActor({ active: true, usedFlag: { combatId: 'combat1' } });
    const result = await toggleGravityOptional(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'gravityOptionalActive', false);
  });
});
