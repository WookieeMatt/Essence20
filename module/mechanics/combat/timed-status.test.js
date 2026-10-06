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

  test("stamps a round duration onto the created effect when a combat is running", async () => {
    global.game.combat = { round: 2, turn: 1, started: true };
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

  // Book check 2026-10-06 (follow-ups): out of combat a round is 6 seconds - a rounds:N stamp the follow-ups sweep reads.
  test("with no running combat, stamps a rounds:N expiry (6 seconds a round) instead", async () => {
    global.game.time = { worldTime: 100 };
    const effect = makeEffect('frightened');
    const actor = makeActor([effect]);

    await applyTimedCondition(actor, 'frightened', 3);

    expect(effect.update).toHaveBeenCalledWith({ 'flags.essence20.oocConditionExpiry': { until: 'rounds:3', stamp: expect.objectContaining({ oocRounds: 3, time: 100 }) } });
  });

  test("no matching effect on the actor is a no-op past the toggle", async () => {
    global.game.combat = { round: 2, turn: 1 };
    const actor = makeActor([]);

    await expect(applyTimedCondition(actor, 'frightened', 3)).resolves.toBeUndefined();
  });
});
