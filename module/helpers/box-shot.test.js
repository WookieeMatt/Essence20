import { jest } from '@jest/globals';
import { canUseBoxShot, isBoxShotActive, toggleBoxShot } from './box-shot.mjs';

global.game = { combat: null };

function makeActor({ active = false, usedFlag = undefined } = {}) {
  const flagStore = { boxShotActive: active, boxShotUsedThisEncounter: usedFlag };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

beforeEach(() => {
  game.combat = { id: 'combat1', round: 1, turn: 0 };
});

afterEach(() => {
  game.combat = null;
});

describe("isBoxShotActive", () => {
  test("false by default", () => {
    expect(isBoxShotActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isBoxShotActive(makeActor({ active: true }))).toBe(true);
  });
});

describe("canUseBoxShot", () => {
  test("true, not yet used this scene", () => {
    expect(canUseBoxShot(makeActor())).toBe(true);
  });

  test("false once already used this scene, while inactive", () => {
    const actor = makeActor({ usedFlag: { epoch: 1, window: 'encounter', count: 1 } });
    expect(canUseBoxShot(actor)).toBe(false);
  });

  test("true while already active, even if used this scene (so it can be turned back off)", () => {
    const actor = makeActor({ active: true, usedFlag: { epoch: 1, window: 'encounter', count: 1 } });
    expect(canUseBoxShot(actor)).toBe(true);
  });
});

describe("toggleBoxShot", () => {
  test("turns it on from off, marks the scene used, and returns true", async () => {
    const actor = makeActor();
    const result = await toggleBoxShot(actor);
    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'boxShotActive', true);
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'boxShotUsedThisEncounter', expect.objectContaining({ epoch: 1, window: 'encounter', count: 1 }),
    );
    expect(isBoxShotActive(actor)).toBe(true);
  });

  test("turns it off from on, without re-marking the scene used, and returns false", async () => {
    const actor = makeActor({ active: true });
    const result = await toggleBoxShot(actor);
    expect(result).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'boxShotActive', false);
    expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'boxShotUsedThisEncounter', expect.anything());
    expect(isBoxShotActive(actor)).toBe(false);
  });
});
