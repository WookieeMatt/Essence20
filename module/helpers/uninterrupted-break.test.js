import { jest } from '@jest/globals';
import { applyUninterruptedBreakBenefit, canUseUninterruptedBreak } from './uninterrupted-break.mjs';

global.game = {
  combat: { id: 'combat1', round: 1 },
  socket: { emit: jest.fn() },
};

function makeActor({ id = 'actor1', name = 'Actor', health = 3, healthMax = 10, flags = {} } = {}) {
  return {
    id, name,
    system: { health: { value: health, max: healthMax } },
    getActiveTokens: jest.fn(() => [{ document: { disposition: 1 }, center: {} }]),
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => { flags[key] = value; }),
    update: jest.fn(),
  };
}

function setAllies(allies, actorToken) {
  global.canvas = {
    tokens: {
      placeables: [
        actorToken,
        ...allies.map(a => ({ actor: a, document: { disposition: 1 }, center: {} })),
      ],
    },
    grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
  };
}

beforeEach(() => {
  game.socket.emit.mockClear();
});

describe("canUseUninterruptedBreak", () => {
  test("true when neither benefit has been used this scene", () => {
    expect(canUseUninterruptedBreak(makeActor())).toBe(true);
  });

  test("true when only one benefit has been used this scene", () => {
    const actor = makeActor({ flags: { uninterruptedBreakHealUsedThisEncounter: { combatId: 'combat1' } } });
    expect(canUseUninterruptedBreak(actor)).toBe(true);
  });

  test("false once both benefits have been used this scene", () => {
    const actor = makeActor({
      flags: {
        uninterruptedBreakHealUsedThisEncounter: { combatId: 'combat1' },
        uninterruptedBreakStoryPointUsedThisEncounter: { combatId: 'combat1' },
      },
    });
    expect(canUseUninterruptedBreak(actor)).toBe(false);
  });
});

describe("applyUninterruptedBreakBenefit", () => {
  test("'heal' restores 2 Health to the granter and every nearby ally, capped at max", async () => {
    const actor = makeActor({ id: 'leader', health: 3 });
    const ally = makeActor({ id: 'ally1', health: 9, healthMax: 10 });
    setAllies([ally], { document: { disposition: 1 }, center: {} });

    await applyUninterruptedBreakBenefit(actor, 'heal');

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    expect(ally.update).toHaveBeenCalledWith({ 'system.health.value': 10 }); // capped at max, not 11
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'uninterruptedBreakHealUsedThisEncounter', expect.any(Object),
    );
  });

  test("'storyPoint' requests a grant and marks that benefit used", async () => {
    const actor = makeActor({ id: 'leader', name: 'Leader' });

    await applyUninterruptedBreakBenefit(actor, 'storyPoint');

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
      action: 'grantStoryPoints', amount: 1, actorName: 'Leader',
    });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'uninterruptedBreakStoryPointUsedThisEncounter', expect.any(Object),
    );
  });
});
