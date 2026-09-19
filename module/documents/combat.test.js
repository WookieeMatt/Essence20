import { jest } from '@jest/globals';

/**
 * Essence20Combat extends the global Combat and constructs a Dice in its constructor, so both have
 * to exist before the module is imported - hence the dynamic import below.
 */
global.Combat = class Combat {
  async _onStartTurn() {}
  async _onEndRound() {}
  _onDelete() {}
};

global.ChatMessage = { getSpeaker: () => ({}), create: jest.fn() };

const { Essence20Combat } = await import('./combat.mjs');

/**
 * A combat instance without running the real constructor, which wants a live Dice/RollDialog.
 */
function makeCombat() {
  return Object.create(Essence20Combat.prototype);
}

function setGame({ isActiveGM = true, mode = 'track' } = {}) {
  const store = { sceneClockScene: 1, sceneClockEncounter: 1 };
  global.game = {
    user: { isGM: isActiveGM, isActiveGM },
    // expireAoeRegions gates on the designated GM via game.users, not game.user.
    users: { activeGM: { isSelf: isActiveGM } },
    settings: {
      get: jest.fn((scope, key) => (key === 'actionEconomyMode' ? mode : store[key])),
      set: jest.fn(async (scope, key, value) => {
        store[key] = value;
      }),
    },
  };

  return store;
}

describe("_onDelete", () => {
  /* Ending a combat used to throw "The Combat <id> does not exist in combats". The override
     cleared each Combatant's action ledger on the way out, but Combatants are embedded in the
     Combat being deleted - so unsetFlag made the server resolve an already-deleted parent by uuid.
     Nothing needs clearing: the ledgers die with the Combatants. These tests pin that. */
  test("does not touch any combatant on the way out", () => {
    setGame();
    const combat = makeCombat();
    const combatant = { unsetFlag: jest.fn(), getFlag: jest.fn(() => ({ standard: 1 })) };
    combat.combatants = [combatant];

    combat._onDelete({}, 'user1');

    expect(combatant.unsetFlag).not.toHaveBeenCalled();
  });

  test("advances the encounter counter so once-per-encounter abilities refresh", async () => {
    const store = setGame();
    const combat = makeCombat();
    combat.combatants = [];

    combat._onDelete({}, 'user1');
    await Promise.resolve();

    expect(store.sceneClockEncounter).toBe(2);
    expect(store.sceneClockScene).toBe(1);
  });

  test("only the designated GM advances it", async () => {
    const store = setGame({ isActiveGM: false });
    const combat = makeCombat();
    combat.combatants = [];

    combat._onDelete({}, 'user1');
    await Promise.resolve();

    expect(store.sceneClockEncounter).toBe(1);
  });

  // _onDelete is synchronous, so the counter bump is fire-and-forget; a failure must not surface
  // as an unhandled rejection while the world is tearing the combat down.
  test("a failed settings write is caught rather than left unhandled", async () => {
    setGame();
    global.game.settings.set = jest.fn(async () => {
      throw new Error('no permission');
    });

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const combat = makeCombat();
    combat.combatants = [];

    expect(() => combat._onDelete({}, 'user1')).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("_onEndRound", () => {
  /* A round-based AoE has no other way to expire mid-fight. CONFIG.time.roundTime is 0 in this
     system, so advancing a round moves no world time and the updateWorldTime sweep never sees it;
     without this hook a "3 rounds" area sat on the map until deleteCombat swept it. */
  test("sweeps expired areas with the round that just ended", async () => {
    setGame();
    const scene = { regions: [] };
    global.game.scenes = [scene];
    const combat = makeCombat();
    await combat._onEndRound({ round: 3 });

    // Nothing to delete here; what matters is that the sweep ran against a real scene list
    // rather than throwing, and that it was reached at all.
    expect(scene.regions).toEqual([]);
  });

  test("deletes an area whose rounds have run out, inclusive of the round it was placed in", async () => {
    setGame();
    const deleted = [];
    const region = {
      id: 'r1',
      getFlag: () => ({ duration: { units: 'rounds', value: 3 }, placedAtRound: 1 }),
    };
    const scene = {
      regions: [region],
      deleteEmbeddedDocuments: jest.fn(async (type, ids) => deleted.push(...ids)),
    };
    global.game.scenes = [scene];
    global.game.time = { worldTime: 0 };
    const combat = makeCombat();
    // this.round has already advanced to 4 by the time _onEndRound fires; the ending round
    // arrives in the context, and reading this.round instead expired areas a round early.
    combat.round = 4;

    await combat._onEndRound({ round: 3 });

    expect(deleted).toEqual(['r1']);
  });

  test("leaves an area alone while its rounds are still running", async () => {
    setGame();
    const region = {
      id: 'r1',
      getFlag: () => ({ duration: { units: 'rounds', value: 3 }, placedAtRound: 1 }),
    };
    const scene = { regions: [region], deleteEmbeddedDocuments: jest.fn() };
    global.game.scenes = [scene];
    global.game.time = { worldTime: 0 };
    const combat = makeCombat();
    combat.round = 3;

    await combat._onEndRound({ round: 2 });

    expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  });
});

// _onEndRound fires post-commit, so this.round is already the NEXT round. Reading it instead of
// the context's round deleted a "3 rounds" area as round 3 began rather than after it ended.
test("judges by the round that ended, not the one about to start", async () => {
  setGame();
  const scene = {
    regions: [{ id: 'r1', getFlag: () => ({ duration: { units: 'rounds', value: 3 }, placedAtRound: 1 }) }],
    deleteEmbeddedDocuments: jest.fn(),
  };
  global.game.scenes = [scene];
  global.game.time = { worldTime: 0 };
  const combat = makeCombat();
  combat.round = 3;

  await combat._onEndRound({ round: 2 });

  expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled();
});

test("leaves round-based areas alone when the context carries no round", async () => {
  setGame();
  const scene = {
    regions: [{ id: 'r1', getFlag: () => ({ duration: { units: 'rounds', value: 3 }, placedAtRound: 1 }) }],
    deleteEmbeddedDocuments: jest.fn(),
  };
  global.game.scenes = [scene];
  global.game.time = { worldTime: 0 };
  const combat = makeCombat();
  combat.round = 9;

  await combat._onEndRound({});

  expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled();
});
