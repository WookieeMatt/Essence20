import { jest } from '@jest/globals';
import { getNearbyEnemyTokens } from './enemies.mjs';

global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

describe("getNearbyEnemyTokens", () => {
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

  test("returns enemies within range with a DIFFERENT Disposition", () => {
    const { actor, token } = makeActorWithToken(1);
    const enemy = makeToken({ disposition: -1 });
    canvas.tokens.placeables = [token, enemy];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getNearbyEnemyTokens(actor, 10)).toEqual([enemy]);
  });

  test("excludes tokens beyond the radius", () => {
    const { actor, token } = makeActorWithToken(1);
    const farEnemy = makeToken({ disposition: -1 });
    canvas.tokens.placeables = [token, farEnemy];
    canvas.grid.measurePath.mockReturnValue({ distance: 15 });

    expect(getNearbyEnemyTokens(actor, 10)).toEqual([]);
  });

  test("excludes tokens sharing the same Disposition (not enemies)", () => {
    const { actor, token } = makeActorWithToken(1);
    const ally = makeToken({ disposition: 1 });
    canvas.tokens.placeables = [token, ally];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getNearbyEnemyTokens(actor, 10)).toEqual([]);
  });

  test("excludes the actor's own token from its own results", () => {
    const { actor, token } = makeActorWithToken(1);
    canvas.tokens.placeables = [token];
    canvas.grid.measurePath.mockReturnValue({ distance: 0 });

    expect(getNearbyEnemyTokens(actor, 10)).toEqual([]);
  });

  test("excludes tokens with no actor at all", () => {
    const { actor, token } = makeActorWithToken(1);
    const emptyToken = { actor: null, document: { disposition: -1 }, center: {} };
    canvas.tokens.placeables = [token, emptyToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getNearbyEnemyTokens(actor, 10)).toEqual([]);
  });

  test("returns an empty array when the actor has no token on the scene", () => {
    const actor = { getActiveTokens: jest.fn(() => []) };
    expect(getNearbyEnemyTokens(actor, 10)).toEqual([]);
  });

  test("returns an empty array when there's no canvas at all (no scene loaded)", () => {
    const { actor } = makeActorWithToken(1);
    const originalCanvas = global.canvas;
    global.canvas = undefined;

    expect(getNearbyEnemyTokens(actor, 10)).toEqual([]);

    global.canvas = originalCanvas;
  });

  test("finds multiple enemies within range", () => {
    const { actor, token } = makeActorWithToken(1);
    const enemy1 = makeToken({ disposition: -1 });
    const enemy2 = makeToken({ disposition: -1 });
    canvas.tokens.placeables = [token, enemy1, enemy2];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getNearbyEnemyTokens(actor, 10)).toEqual([enemy1, enemy2]);
  });
});
