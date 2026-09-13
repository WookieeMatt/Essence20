import { jest } from '@jest/globals';
import { activateHarass, canUseHarass } from './harass.mjs';

global.game = { combat: { id: 'combat1', round: 1, turn: 0 } };

function makeActor({ flag = undefined } = {}) {
  return {
    getFlag: jest.fn(() => flag),
    setFlag: jest.fn(),
  };
}

describe("canUseHarass", () => {
  test("true with no prior use this turn", () => {
    expect(canUseHarass(makeActor())).toBe(true);
  });

  test("false once already used this turn", () => {
    const actor = makeActor({ flag: { combatId: 'combat1', round: 1, turn: 0 } });
    expect(canUseHarass(actor)).toBe(false);
  });

  test("true again next turn (stale record)", () => {
    const actor = makeActor({ flag: { combatId: 'combat1', round: 1, turn: 1 } });
    expect(canUseHarass(actor)).toBe(true);
  });
});

describe("activateHarass", () => {
  test("marks the turn used and banks an Edge", async () => {
    const actor = makeActor();

    await activateHarass(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'harassUsedThisTurn',
      expect.objectContaining({ combatId: 'combat1', round: 1, turn: 0 }));
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pendingHarassEdge',
      expect.objectContaining({ edge: true }));
  });
});
