import { jest } from '@jest/globals';
import {
  activateRushTheLine, deactivateRushTheLineAtTurnEnd, isRushTheLineActive, PENDING_RUSH_THE_LINE_EDGE_FLAG,
} from './rush-the-line.mjs';

global.game = { combat: null };

function makeActor(active = false) {
  const flagStore = { rushTheLineActive: active };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isRushTheLineActive", () => {
  test("false by default", () => {
    expect(isRushTheLineActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isRushTheLineActive(makeActor(true))).toBe(true);
  });
});

describe("activateRushTheLine", () => {
  test("sets the active flag and banks a pending Edge", async () => {
    const actor = makeActor(false);

    await activateRushTheLine(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'rushTheLineActive', true);
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', PENDING_RUSH_THE_LINE_EDGE_FLAG, expect.objectContaining({ edge: true }),
    );
    expect(isRushTheLineActive(actor)).toBe(true);
  });
});

describe("deactivateRushTheLineAtTurnEnd", () => {
  test("clears the flag when active", async () => {
    const actor = makeActor(true);
    await deactivateRushTheLineAtTurnEnd(actor);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'rushTheLineActive', false);
  });

  test("does nothing when already inactive", async () => {
    const actor = makeActor(false);
    await deactivateRushTheLineAtTurnEnd(actor);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
