import { jest } from '@jest/globals';
import {
  activateSprinterBoost, canUseSprinterBoost, deactivateSprinterBoostAtTurnEnd, isSprinterBoostActive,
} from './sprinter-boost.mjs';

global.game = { combat: null };

function makeActor({ active = false, usedFlag = undefined } = {}) {
  const flagStore = { sprinterBoostActive: active, sprinterBoostUsedThisEncounter: usedFlag };
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

describe("canUseSprinterBoost", () => {
  test("true, not yet used this scene", () => {
    expect(canUseSprinterBoost(makeActor())).toBe(true);
  });

  test("false once already used this scene", () => {
    const actor = makeActor({ usedFlag: { epoch: 1, window: 'encounter', count: 1 } });
    expect(canUseSprinterBoost(actor)).toBe(false);
  });
});

describe("isSprinterBoostActive", () => {
  test("false by default", () => {
    expect(isSprinterBoostActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isSprinterBoostActive(makeActor({ active: true }))).toBe(true);
  });
});

describe("activateSprinterBoost", () => {
  test("sets the active flag and marks the scene used", async () => {
    const actor = makeActor();

    await activateSprinterBoost(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'sprinterBoostActive', true);
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'sprinterBoostUsedThisEncounter', expect.objectContaining({ epoch: 1, window: 'encounter', count: 1 }),
    );
    expect(isSprinterBoostActive(actor)).toBe(true);
  });
});

describe("deactivateSprinterBoostAtTurnEnd", () => {
  test("clears the flag when active", async () => {
    const actor = makeActor({ active: true });
    await deactivateSprinterBoostAtTurnEnd(actor);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'sprinterBoostActive', false);
  });

  test("does nothing when already inactive", async () => {
    const actor = makeActor({ active: false });
    await deactivateSprinterBoostAtTurnEnd(actor);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
