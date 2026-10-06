import { jest } from '@jest/globals';
import { activateAbsoluteMenace } from './absolute-menace.mjs';

global.canvas = {
  tokens: { placeables: [], setTargets: jest.fn() },
  grid: { measurePath: jest.fn(() => ({ distance: 5 })) },
};

function makeToken({ id, disposition = -1 } = {}) {
  return { id, actor: { id: `actor-${id}` }, document: { disposition }, center: {} };
}

describe("activateAbsoluteMenace", () => {
  beforeEach(() => {
    canvas.tokens.setTargets.mockReset();
    canvas.tokens.placeables = [];
  });

  test("targets every nearby enemy and rolls Intimidation vs. Willpower", async () => {
    const selfToken = makeToken({ id: 'self', disposition: 1 });
    const enemy1 = makeToken({ id: 'e1', disposition: -1 });
    const enemy2 = makeToken({ id: 'e2', disposition: -1 });
    canvas.tokens.placeables = [selfToken, enemy1, enemy2];

    const actor = {
      getActiveTokens: jest.fn(() => [selfToken]),
      _dice: { rollSkill: jest.fn() },
    };

    await activateAbsoluteMenace(actor);

    expect(canvas.tokens.setTargets).toHaveBeenCalledWith(['e1', 'e2']);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'intimidation', essence: 'social', defenseType: 'willpower', isAbsoluteMenace: true }),
      actor,
    );
  });

  test("targets nothing when no enemies are nearby, but still rolls", async () => {
    const selfToken = makeToken({ id: 'self', disposition: 1 });
    canvas.tokens.placeables = [selfToken];

    const actor = {
      getActiveTokens: jest.fn(() => [selfToken]),
      _dice: { rollSkill: jest.fn() },
    };

    await activateAbsoluteMenace(actor);

    expect(canvas.tokens.setTargets).toHaveBeenCalledWith([]);
    expect(actor._dice.rollSkill).toHaveBeenCalled();
  });
});
