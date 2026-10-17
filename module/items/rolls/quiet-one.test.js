import { jest } from '@jest/globals';
import { markQuietOneNoisyAction } from './quiet-one.mjs';

global.game = { combat: null };

function makeActor(id) {
  const flagStore = {};
  return {
    id,
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

// The Quiet One's Use (offered while an ally carries this stamp this round) is a rule on the Perk -
// rules/conv15-banked.test.js.
describe("markQuietOneNoisyAction", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("stamps the actor with the running combat and round", async () => {
    const ally = makeActor('ally1');
    game.combat = { id: 'combat1', round: 2 };
    await markQuietOneNoisyAction(ally);
    expect(ally.setFlag).toHaveBeenCalledWith('essence20', 'quietOneNoisyActionThisRound', { combatId: 'combat1', round: 2 });
  });

  test("doesn't mark anything outside combat", async () => {
    const ally = makeActor('ally1');
    await markQuietOneNoisyAction(ally);
    expect(ally.setFlag).not.toHaveBeenCalled();
  });
});
