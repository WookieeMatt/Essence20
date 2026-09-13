import { jest } from '@jest/globals';
import { activateQuietOne, canUseQuietOne, getQuietOneEdge, markQuietOneNoisyAction } from './quiet-one.mjs';

global.game = { combat: null };

function makeActor(id, disposition = 1) {
  const flagStore = {};
  const token = { document: { disposition } };
  return {
    id,
    getActiveTokens: jest.fn(() => [token]),
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    _token: token,
  };
}

function makeCombatant(actor, disposition = 1) {
  return { actor, token: { disposition } };
}

describe("markQuietOneNoisyAction / canUseQuietOne", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("an ally's noisy action makes canUseQuietOne true for a same-disposition holder", async () => {
    const ally = makeActor('ally1', 1);
    const holder = makeActor('holder1', 1);
    game.combat = { id: 'combat1', round: 2, combatants: [makeCombatant(ally, 1), makeCombatant(holder, 1)] };

    await markQuietOneNoisyAction(ally);

    expect(canUseQuietOne(holder)).toBe(true);
  });

  test("false without any noisy ally", () => {
    const holder = makeActor('holder1', 1);
    game.combat = { id: 'combat1', round: 2, combatants: [makeCombatant(holder, 1)] };
    expect(canUseQuietOne(holder)).toBe(false);
  });

  test("false for an enemy's (opposing-disposition) noisy action", async () => {
    const enemy = makeActor('enemy1', -1);
    const holder = makeActor('holder1', 1);
    game.combat = { id: 'combat1', round: 2, combatants: [makeCombatant(enemy, -1), makeCombatant(holder, 1)] };

    await markQuietOneNoisyAction(enemy);

    expect(canUseQuietOne(holder)).toBe(false);
  });

  test("false for a stale flag from a different round", async () => {
    const ally = makeActor('ally1', 1);
    const holder = makeActor('holder1', 1);
    game.combat = { id: 'combat1', round: 2, combatants: [makeCombatant(ally, 1), makeCombatant(holder, 1)] };
    await markQuietOneNoisyAction(ally);

    game.combat = { id: 'combat1', round: 3, combatants: [makeCombatant(ally, 1), makeCombatant(holder, 1)] };
    expect(canUseQuietOne(holder)).toBe(false);
  });

  test("doesn't mark or check anything outside combat", async () => {
    game.combat = null;
    const ally = makeActor('ally1', 1);
    await markQuietOneNoisyAction(ally);
    expect(ally.setFlag).not.toHaveBeenCalled();

    const holder = makeActor('holder1', 1);
    expect(canUseQuietOne(holder)).toBe(false);
  });
});

describe("activateQuietOne / getQuietOneEdge", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("banks an Edge for the current turn when a noisy ally is present", async () => {
    const ally = makeActor('ally1', 1);
    const holder = makeActor('holder1', 1);
    game.combat = { id: 'combat1', round: 2, turn: 0, combatants: [makeCombatant(ally, 1), makeCombatant(holder, 1)] };
    await markQuietOneNoisyAction(ally);

    const result = await activateQuietOne(holder);

    expect(result).toBe(true);
    expect(getQuietOneEdge(holder)).toBe(true);
  });

  test("returns false and banks nothing without a noisy ally", async () => {
    const holder = makeActor('holder1', 1);
    game.combat = { id: 'combat1', round: 2, turn: 0, combatants: [makeCombatant(holder, 1)] };

    const result = await activateQuietOne(holder);

    expect(result).toBe(false);
    expect(getQuietOneEdge(holder)).toBe(false);
  });

  test("getQuietOneEdge is false once a new turn starts", async () => {
    const ally = makeActor('ally1', 1);
    const holder = makeActor('holder1', 1);
    game.combat = { id: 'combat1', round: 2, turn: 0, combatants: [makeCombatant(ally, 1), makeCombatant(holder, 1)] };
    await markQuietOneNoisyAction(ally);
    await activateQuietOne(holder);

    game.combat = { ...game.combat, turn: 1 };
    expect(getQuietOneEdge(holder)).toBe(false);
  });
});
