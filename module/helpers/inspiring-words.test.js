import { jest } from '@jest/globals';
import { canUseInspiringWords, markInspiringWordsUsed } from './inspiring-words.mjs';

global.game = { combat: null };

function makeActor(flags = {}) {
  return {
    getFlag: jest.fn((scope, key) => (scope == 'essence20' ? flags[key] : undefined)),
    setFlag: jest.fn(async (scope, key, value) => { flags[key] = value; }),
  };
}

describe("canUseInspiringWords", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("false outside of combat entirely", () => {
    game.combat = null;
    expect(canUseInspiringWords(makeActor())).toBe(false);
  });

  test("true with a fresh combat and no prior uses", () => {
    game.combat = { id: 'c1', round: 1, turn: 0 };
    expect(canUseInspiringWords(makeActor())).toBe(true);
  });

  test("true with 1 use already spent this encounter, on a new turn", () => {
    game.combat = { id: 'c1', round: 1, turn: 1 };
    const actor = makeActor({ inspiringWordsUsesRemaining: { combatId: 'c1', usesRemaining: 1 } });
    expect(canUseInspiringWords(actor)).toBe(true);
  });

  test("false once both uses are spent this encounter", () => {
    game.combat = { id: 'c1', round: 1, turn: 1 };
    const actor = makeActor({ inspiringWordsUsesRemaining: { combatId: 'c1', usesRemaining: 0 } });
    expect(canUseInspiringWords(actor)).toBe(false);
  });

  test("false a second time on the same turn, even with a use remaining", () => {
    game.combat = { id: 'c1', round: 1, turn: 0 };
    const actor = makeActor({
      inspiringWordsUsesRemaining: { combatId: 'c1', usesRemaining: 1 },
      inspiringWordsUsedThisTurn: { combatId: 'c1', round: 1, turn: 0 },
    });
    expect(canUseInspiringWords(actor)).toBe(false);
  });

  test("resets to 2 fresh uses in a brand new combat, ignoring a stale flag from a finished one", () => {
    game.combat = { id: 'c2', round: 1, turn: 0 };
    const actor = makeActor({ inspiringWordsUsesRemaining: { combatId: 'c1', usesRemaining: 0 } });
    expect(canUseInspiringWords(actor)).toBe(true);
  });
});

describe("markInspiringWordsUsed", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("decrements usesRemaining from a fresh state and marks the turn used", async () => {
    game.combat = { id: 'c1', round: 1, turn: 0 };
    const actor = makeActor();

    await markInspiringWordsUsed(actor);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'inspiringWordsUsesRemaining', { combatId: 'c1', usesRemaining: 1 },
    );
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'inspiringWordsUsedThisTurn', { combatId: 'c1', round: 1, turn: 0 },
    );
  });

  test("floors usesRemaining at 0 rather than going negative", async () => {
    game.combat = { id: 'c1', round: 1, turn: 0 };
    const actor = makeActor({ inspiringWordsUsesRemaining: { combatId: 'c1', usesRemaining: 0 } });

    await markInspiringWordsUsed(actor);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'inspiringWordsUsesRemaining', { combatId: 'c1', usesRemaining: 0 },
    );
  });

  test("no-ops outside of combat", async () => {
    game.combat = null;
    const actor = makeActor();

    await markInspiringWordsUsed(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
