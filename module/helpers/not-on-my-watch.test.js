import { jest } from '@jest/globals';
import { getNotOnMyWatchDefenseBonus, hasDefeatedAllyInReach } from './not-on-my-watch.mjs';

global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

function makeActorToken(disposition = 1) {
  return { document: { disposition }, center: {} };
}

function makeAllyToken({ defeated = false, disposition = 1 } = {}) {
  return {
    actor: { statuses: new Set(defeated ? ['defeated'] : []) },
    document: { disposition },
    center: {},
  };
}

describe("hasDefeatedAllyInReach", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
    canvas.grid.measurePath.mockReturnValue({ distance: 0 });
  });

  test("true when a Defeated ally is within 5ft", () => {
    const actorToken = makeActorToken();
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ defeated: true })];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(hasDefeatedAllyInReach(actor)).toBe(true);
  });

  test("false when the Defeated ally is beyond 5ft", () => {
    const actorToken = makeActorToken();
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ defeated: true })];
    canvas.grid.measurePath.mockReturnValue({ distance: 10 });

    expect(hasDefeatedAllyInReach(actor)).toBe(false);
  });

  test("false when no nearby ally is Defeated", () => {
    const actorToken = makeActorToken();
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ defeated: false })];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(hasDefeatedAllyInReach(actor)).toBe(false);
  });

  test("false when the only Defeated token is an enemy, not an ally", () => {
    const actorToken = makeActorToken(1);
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ defeated: true, disposition: -1 })];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(hasDefeatedAllyInReach(actor)).toBe(false);
  });

  test("false with no token on the scene at all", () => {
    const actor = { getActiveTokens: jest.fn(() => []) };
    expect(hasDefeatedAllyInReach(actor)).toBe(false);
  });
});

describe("getNotOnMyWatchDefenseBonus", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
  });

  test("+1 for Toughness and Evasion while a Defeated ally is in Reach", () => {
    const actorToken = makeActorToken();
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ defeated: true })];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getNotOnMyWatchDefenseBonus(actor, 'toughness')).toBe(1);
    expect(getNotOnMyWatchDefenseBonus(actor, 'evasion')).toBe(1);
  });

  test("0 for a different Defense type", () => {
    const actorToken = makeActorToken();
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ defeated: true })];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getNotOnMyWatchDefenseBonus(actor, 'willpower')).toBe(0);
  });

  test("0 with no Defeated ally in Reach", () => {
    const actorToken = makeActorToken();
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 0 });

    expect(getNotOnMyWatchDefenseBonus(actor, 'toughness')).toBe(0);
  });
});
