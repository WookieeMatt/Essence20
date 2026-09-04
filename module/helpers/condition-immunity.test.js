import { jest } from '@jest/globals';
import { isImmuneToCondition } from './condition-immunity.mjs';

const CAUTION_ID = "Compendium.essence20.gi_joe_crb.Item.pJcXVybdqjcWHpJq";
const BATTLEFIELD_TITAN_ID = "Compendium.essence20.gi_joe_crb.Item.xsFS0pGQFx1w2qTd";

global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

function makeActor(perkIds = []) {
  const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
  return { items };
}

describe("isImmuneToCondition (Caution, Bodyguard Focus, 17th level)", () => {
  test.each(['blinded', 'deafened', 'frightened', 'immobilized', 'restrained', 'stunned'])(
    "true for %s with the Perk", (statusId) => {
      expect(isImmuneToCondition(makeActor([CAUTION_ID]), statusId)).toBe(true);
    },
  );

  test("false for a Condition not covered by Caution", () => {
    expect(isImmuneToCondition(makeActor([CAUTION_ID]), 'prone')).toBe(false);
  });

  test("false without the Perk", () => {
    expect(isImmuneToCondition(makeActor(), 'frightened')).toBe(false);
  });

  test("false for an actor with unrelated Perks", () => {
    expect(isImmuneToCondition(makeActor(["Compendium.essence20.gi_joe_crb.Item.other"]), 'frightened')).toBe(false);
  });
});

describe("isImmuneToCondition (Battlefield Titan, Vanguard Focus, 9th level) - aura", () => {
  function makeToken({ actor, disposition = 1 } = {}) {
    return { actor, document: { disposition }, center: {} };
  }

  function makeActorWithToken({ perkIds = [], disposition = 1 } = {}) {
    const actor = makeActor(perkIds);
    const token = makeToken({ actor, disposition });
    actor.getActiveTokens = jest.fn(() => [token]);
    return { actor, token };
  }

  beforeEach(() => {
    canvas.tokens.placeables = [];
    canvas.grid.measurePath.mockReset();
    canvas.grid.measurePath.mockReturnValue({ distance: 0 });
  });

  test.each(['mesmerized', 'frightened'])("the holder is immune to %s themselves", (statusId) => {
    const { actor } = makeActorWithToken({ perkIds: [BATTLEFIELD_TITAN_ID] });
    expect(isImmuneToCondition(actor, statusId)).toBe(true);
  });

  test("an ally within 10 feet of the holder is also immune", () => {
    const { token: titanToken } = makeActorWithToken({ perkIds: [BATTLEFIELD_TITAN_ID] });
    const { actor: allyActor, token: allyToken } = makeActorWithToken();
    canvas.tokens.placeables = [titanToken, allyToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(isImmuneToCondition(allyActor, 'frightened')).toBe(true);
  });

  test("doesn't apply beyond 10 feet", () => {
    const { token: titanToken } = makeActorWithToken({ perkIds: [BATTLEFIELD_TITAN_ID] });
    const { actor: allyActor, token: allyToken } = makeActorWithToken();
    canvas.tokens.placeables = [titanToken, allyToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 15 });

    expect(isImmuneToCondition(allyActor, 'frightened')).toBe(false);
  });

  test("doesn't apply to a hostile token (not an ally)", () => {
    const { token: titanToken } = makeActorWithToken({ perkIds: [BATTLEFIELD_TITAN_ID], disposition: 1 });
    const { actor: enemyActor, token: enemyToken } = makeActorWithToken({ disposition: -1 });
    canvas.tokens.placeables = [titanToken, enemyToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(isImmuneToCondition(enemyActor, 'frightened')).toBe(false);
  });

  test("doesn't cover a Condition outside its own list (e.g. Stunned)", () => {
    const { actor } = makeActorWithToken({ perkIds: [BATTLEFIELD_TITAN_ID] });
    expect(isImmuneToCondition(actor, 'stunned')).toBe(false);
  });

  test("an ally with no nearby Battlefield Titan holder is unaffected", () => {
    const { actor: allyActor, token: allyToken } = makeActorWithToken();
    canvas.tokens.placeables = [allyToken];

    expect(isImmuneToCondition(allyActor, 'frightened')).toBe(false);
  });
});
