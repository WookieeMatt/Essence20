import { jest } from '@jest/globals';
import { getAllNearbyTokens, getNearbyAllyTokens, getColonyChangelingEvasionBonus } from './allies.mjs';

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

  // Frenemy (MLP CRB, General Perk, p.124) - see its own comment in allies.mjs above.
  describe("with Frenemy", () => {
    const FRENEMY_ID = "Compendium.essence20.mlp_crb.Item.N6Bs8to6G0QddMVK";

    function makeFrenemyItem() {
      return { type: 'perk', flags: { core: { sourceId: FRENEMY_ID } } };
    }

    test("includes a different-Disposition token too", () => {
      const { actor, token } = makeActorWithToken(1);
      actor.items = [makeFrenemyItem()];
      const enemy = makeToken({ disposition: -1 });
      canvas.tokens.placeables = [token, enemy];
      canvas.grid.measurePath.mockReturnValue({ distance: 5 });

      expect(getNearbyAllyTokens(actor, 10)).toEqual([enemy]);
    });

    test("without the Perk, a different-Disposition token is still excluded", () => {
      const { actor, token } = makeActorWithToken(1);
      actor.items = [];
      const enemy = makeToken({ disposition: -1 });
      canvas.tokens.placeables = [token, enemy];
      canvas.grid.measurePath.mockReturnValue({ distance: 5 });

      expect(getNearbyAllyTokens(actor, 10)).toEqual([]);
    });
  });
});

describe("getAllNearbyTokens", () => {
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

  test("returns both allies AND enemies within range, regardless of Disposition", () => {
    const { actor, token } = makeActorWithToken(1);
    const ally = makeToken({ disposition: 1 });
    const enemy = makeToken({ disposition: -1 });
    canvas.tokens.placeables = [token, ally, enemy];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getAllNearbyTokens(actor, 10)).toEqual([ally, enemy]);
  });

  test("excludes tokens beyond the radius", () => {
    const { actor, token } = makeActorWithToken(1);
    const far = makeToken({ disposition: -1 });
    canvas.tokens.placeables = [token, far];
    canvas.grid.measurePath.mockReturnValue({ distance: 15 });

    expect(getAllNearbyTokens(actor, 10)).toEqual([]);
  });

  test("excludes the actor's own token and tokens with no actor at all", () => {
    const { actor, token } = makeActorWithToken(1);
    const emptyToken = { actor: null, document: { disposition: 1 }, center: {} };
    canvas.tokens.placeables = [token, emptyToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getAllNearbyTokens(actor, 10)).toEqual([]);
  });

  test("returns an empty array when the actor has no token on the scene, or no canvas at all", () => {
    const noTokenActor = { getActiveTokens: jest.fn(() => []) };
    expect(getAllNearbyTokens(noTokenActor, 10)).toEqual([]);

    const { actor } = makeActorWithToken(1);
    const originalCanvas = global.canvas;
    global.canvas = undefined;
    expect(getAllNearbyTokens(actor, 10)).toEqual([]);
    global.canvas = originalCanvas;
  });
});

describe("getColonyChangelingEvasionBonus", () => {
  const COLONY_CHANGELING_ID = "Compendium.essence20.dark_skies_over_equestria.Item.FRUWPAePJzm7Mlf0";

  function makeColonyChangelingToken() {
    return {
      actor: { items: [{ type: 'perk', flags: { core: { sourceId: COLONY_CHANGELING_ID } } }] },
      document: { disposition: 1 },
      center: {},
    };
  }

  function makeActorWithToken() {
    const token = { actor: {}, document: { disposition: 1 }, center: {} };
    const actor = { getActiveTokens: jest.fn(() => [token]) };
    return { actor, token };
  }

  beforeEach(() => {
    canvas.tokens.placeables = [];
    canvas.grid.measurePath.mockReset();
    canvas.grid.measurePath.mockReturnValue({ distance: 0 });
  });

  test("counts adjacent Colony Changelings, up to the +3 cap", () => {
    const { actor, token } = makeActorWithToken();
    canvas.tokens.placeables = [token, makeColonyChangelingToken(), makeColonyChangelingToken(),
      makeColonyChangelingToken(), makeColonyChangelingToken()];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getColonyChangelingEvasionBonus(actor)).toBe(3);
  });

  test("excludes Colony Changelings beyond 5ft, and non-Colony-Changeling tokens", () => {
    const { actor, token } = makeActorWithToken();
    const far = makeColonyChangelingToken();
    canvas.tokens.placeables = [token, far];
    canvas.grid.measurePath.mockReturnValue({ distance: 10 });

    expect(getColonyChangelingEvasionBonus(actor)).toBe(0);
  });

  test("returns 0 without a token on the scene", () => {
    const noTokenActor = { getActiveTokens: jest.fn(() => []) };
    expect(getColonyChangelingEvasionBonus(noTokenActor)).toBe(0);
  });
});
