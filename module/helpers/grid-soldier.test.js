import { jest } from '@jest/globals';
import { getGridSoldierImpairedTarget } from './grid-soldier.mjs';

global.canvas = { grid: { measurePath: jest.fn(() => ({ distance: 5 })) } };
global.game = { user: { targets: { first: jest.fn() } } };

function makeToken({ disposition = 1, statuses = [] } = {}) {
  return {
    document: { disposition },
    center: {},
    actor: { statuses: new Set(statuses) },
  };
}

function makeActor(actorToken) {
  return { getActiveTokens: jest.fn(() => [actorToken]) };
}

describe("getGridSoldierImpairedTarget", () => {
  beforeEach(() => {
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });
    game.user.targets.first.mockReturnValue(undefined);
  });

  test("returns the currently-targeted Impaired ally within range", () => {
    const actorToken = makeToken();
    const targetToken = makeToken({ statuses: ['impaired'] });
    game.user.targets.first.mockReturnValue(targetToken);

    expect(getGridSoldierImpairedTarget(makeActor(actorToken))).toBe(targetToken.actor);
  });

  test("falls back to the actor themselves when no target is set", () => {
    const actorToken = makeToken({ statuses: ['impaired'] });

    expect(getGridSoldierImpairedTarget(makeActor(actorToken))).toBe(actorToken.actor);
  });

  test("returns null when the resolved target isn't Impaired", () => {
    const actorToken = makeToken();
    const targetToken = makeToken({ statuses: [] });
    game.user.targets.first.mockReturnValue(targetToken);

    expect(getGridSoldierImpairedTarget(makeActor(actorToken))).toBeNull();
  });

  test("returns null when the target is an enemy", () => {
    const actorToken = makeToken({ disposition: 1 });
    const targetToken = makeToken({ disposition: -1, statuses: ['impaired'] });
    game.user.targets.first.mockReturnValue(targetToken);

    expect(getGridSoldierImpairedTarget(makeActor(actorToken))).toBeNull();
  });

  test("returns null when the target is out of range", () => {
    canvas.grid.measurePath.mockReturnValue({ distance: 6 });
    const actorToken = makeToken();
    const targetToken = makeToken({ statuses: ['impaired'] });
    game.user.targets.first.mockReturnValue(targetToken);

    expect(getGridSoldierImpairedTarget(makeActor(actorToken))).toBeNull();
  });

  test("returns null with no active token", () => {
    const actor = { getActiveTokens: jest.fn(() => []) };
    expect(getGridSoldierImpairedTarget(actor)).toBeNull();
  });
});
