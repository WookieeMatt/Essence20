import { jest } from '@jest/globals';
import { applyTimedCondition } from './timed-status.mjs';

function makeActor(effects = []) {
  return {
    toggleStatusEffect: jest.fn(async () => true),
    effects: {
      find: (predicate) => effects.find(predicate),
    },
  };
}

function makeEffect(statusId) {
  return {
    statuses: new Set([statusId]),
    update: jest.fn(async () => {}),
  };
}

beforeEach(() => {
  global.game = { combat: null };
});

describe("applyTimedCondition", () => {
  test("always toggles the status on", async () => {
    const actor = makeActor();
    await applyTimedCondition(actor, 'frightened', 3);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: true });
  });

  test("stamps a round duration onto the created effect when a combat is active", async () => {
    global.game.combat = { round: 2, turn: 1 };
    const effect = makeEffect('frightened');
    const actor = makeActor([effect]);

    await applyTimedCondition(actor, 'frightened', 3);

    expect(effect.update).toHaveBeenCalledWith({
      'duration.rounds': 3,
      'duration.startRound': 2,
      'duration.startTurn': 1,
    });
  });

  test("does nothing beyond the toggle with no rounds given", async () => {
    global.game.combat = { round: 2, turn: 1 };
    const effect = makeEffect('frightened');
    const actor = makeActor([effect]);

    await applyTimedCondition(actor, 'frightened');

    expect(effect.update).not.toHaveBeenCalled();
  });

  test("does nothing beyond the toggle with no active combat", async () => {
    const effect = makeEffect('frightened');
    const actor = makeActor([effect]);

    await applyTimedCondition(actor, 'frightened', 3);

    expect(effect.update).not.toHaveBeenCalled();
  });

  test("no matching effect on the actor is a no-op past the toggle", async () => {
    global.game.combat = { round: 2, turn: 1 };
    const actor = makeActor([]);

    await expect(applyTimedCondition(actor, 'frightened', 3)).resolves.toBeUndefined();
  });
});
