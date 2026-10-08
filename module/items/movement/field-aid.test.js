import { jest } from '@jest/globals';
import { hasNearbyDefeatedAlly } from './field-aid.mjs';

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

describe("hasNearbyDefeatedAlly", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
  });

  test("true when a Defeated ally is anywhere on the scene", () => {
    const actorToken = makeActorToken();
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ defeated: true })];

    expect(hasNearbyDefeatedAlly(actor)).toBe(true);
  });

  test("false when no ally is Defeated", () => {
    const actorToken = makeActorToken();
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ defeated: false })];

    expect(hasNearbyDefeatedAlly(actor)).toBe(false);
  });

  test("false when the only Defeated token is an enemy, not an ally", () => {
    const actorToken = makeActorToken(1);
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ defeated: true, disposition: -1 })];

    expect(hasNearbyDefeatedAlly(actor)).toBe(false);
  });

  test("false with no token on the scene at all", () => {
    const actor = { getActiveTokens: jest.fn(() => []) };
    expect(hasNearbyDefeatedAlly(actor)).toBe(false);
  });
});
