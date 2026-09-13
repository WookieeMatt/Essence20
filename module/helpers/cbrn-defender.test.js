import { jest } from '@jest/globals';
import { getCbrnDefenderShiftDown, markCbrnDefenderTriggered } from './cbrn-defender.mjs';

global.game = { combat: null };

function makeActor() {
  const flagStore = {};
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("markCbrnDefenderTriggered / getCbrnDefenderShiftDown", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("banks a shiftDown of 1 for the current combat", async () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor();

    await markCbrnDefenderTriggered(actor);

    expect(getCbrnDefenderShiftDown(actor)).toBe(1);
  });

  test("returns 0 with nothing banked", () => {
    expect(getCbrnDefenderShiftDown(makeActor())).toBe(0);
  });

  test("returns 0 once a different combat has started", async () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor();
    await markCbrnDefenderTriggered(actor);

    game.combat = { id: 'combat2' };
    expect(getCbrnDefenderShiftDown(actor)).toBe(0);
  });

  test("applies outside combat too, keyed on a null combatId", async () => {
    game.combat = null;
    const actor = makeActor();
    await markCbrnDefenderTriggered(actor);

    expect(getCbrnDefenderShiftDown(actor)).toBe(1);
  });
});
