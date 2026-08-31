import { jest } from '@jest/globals';
import { getNearbyAllyTokens } from './allies.mjs';

global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

describe("getNearbyAllyTokens", () => {
  function makeToken({ actor = { id: 'actor' }, disposition = 1 } = {}) {
    return { actor, document: { disposition }, center: {} };
  }

  function makeActorWithToken(disposition = 1) {
    const token = makeToken({ disposition });
    const actor = { getActiveTokens: jest.fn(() => [token]) };
    return { actor, token };
  }

  beforeEach(() => {
    canvas.tokens.placeables = [];
    canvas.grid.measurePath.mockReset();
    canvas.grid.measurePath.mockReturnValue({ distance: 0 });
  });

  test("returns allies within range sharing the same Disposition", () => {
    const { actor, token } = makeActorWithToken(1);
    const ally = makeToken({ disposition: 1 });
    canvas.tokens.placeables = [token, ally];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getNearbyAllyTokens(actor, 10)).toEqual([ally]);
  });

  test("excludes tokens beyond the radius", () => {
    const { actor, token } = makeActorWithToken(1);
    const farAlly = makeToken({ disposition: 1 });
    canvas.tokens.placeables = [token, farAlly];
    canvas.grid.measurePath.mockReturnValue({ distance: 15 });

    expect(getNearbyAllyTokens(actor, 10)).toEqual([]);
  });

  test("excludes tokens with a different Disposition (not allies)", () => {
    const { actor, token } = makeActorWithToken(1);
    const enemy = makeToken({ disposition: -1 });
    canvas.tokens.placeables = [token, enemy];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getNearbyAllyTokens(actor, 10)).toEqual([]);
  });

  test("excludes the actor's own token from its own results", () => {
    const { actor, token } = makeActorWithToken(1);
    canvas.tokens.placeables = [token];
    canvas.grid.measurePath.mockReturnValue({ distance: 0 });

    expect(getNearbyAllyTokens(actor, 10)).toEqual([]);
  });

  test("excludes tokens with no actor at all", () => {
    const { actor, token } = makeActorWithToken(1);
    const emptyToken = { actor: null, document: { disposition: 1 }, center: {} };
    canvas.tokens.placeables = [token, emptyToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getNearbyAllyTokens(actor, 10)).toEqual([]);
  });

  test("returns an empty array when the actor has no token on the scene", () => {
    const actor = { getActiveTokens: jest.fn(() => []) };
    expect(getNearbyAllyTokens(actor, 10)).toEqual([]);
  });

  test("returns an empty array when there's no canvas at all (no scene loaded)", () => {
    const { actor } = makeActorWithToken(1);
    const originalCanvas = global.canvas;
    global.canvas = undefined;

    expect(getNearbyAllyTokens(actor, 10)).toEqual([]);

    global.canvas = originalCanvas;
  });

  test("finds multiple allies within range", () => {
    const { actor, token } = makeActorWithToken(1);
    const ally1 = makeToken({ disposition: 1 });
    const ally2 = makeToken({ disposition: 1 });
    canvas.tokens.placeables = [token, ally1, ally2];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getNearbyAllyTokens(actor, 10)).toEqual([ally1, ally2]);
  });
});
