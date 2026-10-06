import { jest } from '@jest/globals';
import { activateForwardObservation, broadcastForwardObservation } from './forward-observation.mjs';

global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

describe("activateForwardObservation", () => {
  test("rolls a flat DIF 15 Alertness Skill Test, flagged for post-hit processing", async () => {
    const actor = { _dice: { rollSkill: jest.fn() } };

    await activateForwardObservation(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'alertness', essence: 'smarts', dif: 15, isForwardObservation: true }),
      actor,
    );
  });
});

describe("broadcastForwardObservation", () => {
  function makeActor({ id, name = 'Actor' } = {}) {
    return { id, name, setFlag: jest.fn(), getActiveTokens: jest.fn(() => []) };
  }

  function makeToken(actor, disposition = 1) {
    return { actor, document: { disposition }, center: {} };
  }

  beforeEach(() => {
    canvas.tokens.placeables = [];
    canvas.grid.measurePath.mockReset();
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });
  });

  test("banks a shiftUp on the actor themselves and every ally within 30ft", async () => {
    const actor = makeActor({ id: 'actor1' });
    const ownToken = makeToken(actor, 1);
    actor.getActiveTokens = jest.fn(() => [ownToken]);
    const ally = makeActor({ id: 'ally1', name: 'Ally' });
    const allyToken = makeToken(ally, 1);
    canvas.tokens.placeables = [ownToken, allyToken];

    await broadcastForwardObservation(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pendingForwardObservation', { shiftUp: 1, combatId: null, round: null });
    expect(ally.setFlag).toHaveBeenCalledWith('essence20', 'pendingForwardObservation', { shiftUp: 1, combatId: null, round: null });
  });

  test("excludes an ally beyond 30ft", async () => {
    const actor = makeActor({ id: 'actor1' });
    const ownToken = makeToken(actor, 1);
    actor.getActiveTokens = jest.fn(() => [ownToken]);
    const farAlly = makeActor({ id: 'ally1', name: 'Far Ally' });
    const farToken = makeToken(farAlly, 1);
    canvas.tokens.placeables = [ownToken, farToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 45 });

    await broadcastForwardObservation(actor);

    expect(actor.setFlag).toHaveBeenCalled();
    expect(farAlly.setFlag).not.toHaveBeenCalled();
  });

  test("excludes an enemy token", async () => {
    const actor = makeActor({ id: 'actor1' });
    const ownToken = makeToken(actor, 1);
    actor.getActiveTokens = jest.fn(() => [ownToken]);
    const enemy = makeActor({ id: 'enemy1', name: 'Enemy' });
    const enemyToken = makeToken(enemy, -1);
    canvas.tokens.placeables = [ownToken, enemyToken];

    await broadcastForwardObservation(actor);

    expect(enemy.setFlag).not.toHaveBeenCalled();
  });
});
