import { jest } from '@jest/globals';
import { checkAndMarkUnluckyForYou } from './unlucky-for-you.mjs';

global.game = { combat: null };

function makeActor(flagValue) {
  const flagStore = { unluckyForYouAffectedTargets: flagValue };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("checkAndMarkUnluckyForYou", () => {
  beforeEach(() => {
    game.combat = { id: 'combat1' };
  });

  afterEach(() => {
    game.combat = null;
  });

  test("true (and marks it) the first time this actor hits a given target this combat", async () => {
    const actor = makeActor(undefined);
    const result = await checkAndMarkUnluckyForYou(actor, 'target1');

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'unluckyForYouAffectedTargets', { combatId: 'combat1', targetIds: ['target1'] },
    );
  });

  test("false on a second hit against the SAME target this combat", async () => {
    const actor = makeActor({ combatId: 'combat1', targetIds: ['target1'] });
    const result = await checkAndMarkUnluckyForYou(actor, 'target1');

    expect(result).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("true for a DIFFERENT target in the same combat", async () => {
    const actor = makeActor({ combatId: 'combat1', targetIds: ['target1'] });
    const result = await checkAndMarkUnluckyForYou(actor, 'target2');

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'unluckyForYouAffectedTargets', { combatId: 'combat1', targetIds: ['target1', 'target2'] },
    );
  });

  test("true again for the same target once it's a new combat (stale flag ignored)", async () => {
    const actor = makeActor({ combatId: 'oldCombat', targetIds: ['target1'] });
    const result = await checkAndMarkUnluckyForYou(actor, 'target1');

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'unluckyForYouAffectedTargets', { combatId: 'combat1', targetIds: ['target1'] },
    );
  });

  test("false outside of combat entirely", async () => {
    game.combat = null;
    const actor = makeActor(undefined);
    const result = await checkAndMarkUnluckyForYou(actor, 'target1');

    expect(result).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
