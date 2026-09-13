import { jest } from '@jest/globals';
import {
  activateGroundSuppression, getGroundSuppressionReduction, markGroundSuppressed, pickGroundSuppressionDefenseType,
} from './ground-suppression.mjs';

global.game = {
  combat: { id: 'combat1', round: 2 },
  i18n: { localize: (key) => key },
};

global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor({ flags = {} } = {}) {
  return {
    getActiveTokens: jest.fn(() => [{ id: 'token1', center: {} }]),
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value; 
    }),
    _dice: { rollSkill: jest.fn() },
  };
}

describe("pickGroundSuppressionDefenseType", () => {
  test("returns the chosen Defense", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('evasion');
    expect(await pickGroundSuppressionDefenseType()).toBe('evasion');
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickGroundSuppressionDefenseType()).toBeNull();
  });
});

describe("activateGroundSuppression", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
    global.canvas = {
      tokens: { placeables: [], setTargets: jest.fn() },
      grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
    };
  });

  test("auto-targets every nearby token (allies and enemies) and triggers the roll", async () => {
    const actor = makeActor();
    const ownToken = actor.getActiveTokens()[0];
    const ally = { id: 'ally1', actor: {}, document: { disposition: 1 }, center: {} };
    const enemy = { id: 'enemy1', actor: {}, document: { disposition: -1 }, center: {} };
    canvas.tokens.placeables = [ownToken, ally, enemy];
    foundry.applications.api.DialogV2.wait.mockResolvedValue('toughness');

    const result = await activateGroundSuppression(actor);

    expect(result).toBe(true);
    expect(canvas.tokens.setTargets).toHaveBeenCalledWith(['ally1', 'enemy1']);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'driving', defenseType: 'toughness', isGroundSuppression: true }), actor,
    );
  });

  test("returns false and triggers nothing when the picker is cancelled", async () => {
    const actor = makeActor();
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');

    const result = await activateGroundSuppression(actor);

    expect(result).toBe(false);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("markGroundSuppressed / getGroundSuppressionReduction", () => {
  test("banks a reduction of 5", async () => {
    const actor = makeActor();
    await markGroundSuppressed(actor);
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingGroundSuppression', expect.objectContaining({ reduction: 5 }),
    );
  });

  test("reads back the banked reduction this same round", () => {
    const actor = makeActor({ flags: { pendingGroundSuppression: { reduction: 5, combatId: 'combat1', round: 2 } } });
    expect(getGroundSuppressionReduction(actor)).toBe(5);
  });

  test("returns 0 once the round has moved on", () => {
    const actor = makeActor({ flags: { pendingGroundSuppression: { reduction: 5, combatId: 'combat1', round: 1 } } });
    expect(getGroundSuppressionReduction(actor)).toBe(0);
  });

  test("returns 0 without a pending mark, or outside combat", () => {
    expect(getGroundSuppressionReduction(makeActor())).toBe(0);

    const actor = makeActor({ flags: { pendingGroundSuppression: { reduction: 5, combatId: 'combat1', round: 2 } } });
    const originalCombat = game.combat;
    game.combat = null;
    expect(getGroundSuppressionReduction(actor)).toBe(0);
    game.combat = originalCombat;
  });
});
