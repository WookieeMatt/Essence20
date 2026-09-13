import { jest } from '@jest/globals';
import { activateWhirlwindStrike } from './whirlwind-strike.mjs';

global.canvas = {
  tokens: { placeables: [], setTargets: jest.fn() },
  grid: { measurePath: jest.fn(() => ({ distance: 5 })) },
};

function makeToken({ id, disposition = -1 } = {}) {
  return { id, actor: { id: `actor-${id}` }, document: { disposition }, center: {} };
}

describe("activateWhirlwindStrike", () => {
  beforeEach(() => {
    canvas.tokens.setTargets.mockReset();
    canvas.tokens.placeables = [];
  });

  test("targets every nearby enemy", () => {
    const selfToken = makeToken({ id: 'self', disposition: 1 });
    const enemy1 = makeToken({ id: 'e1', disposition: -1 });
    const enemy2 = makeToken({ id: 'e2', disposition: -1 });
    canvas.tokens.placeables = [selfToken, enemy1, enemy2];

    const actor = { getActiveTokens: jest.fn(() => [selfToken]) };

    activateWhirlwindStrike(actor);

    expect(canvas.tokens.setTargets).toHaveBeenCalledWith(['e1', 'e2']);
  });

  test("targets nothing when no enemies are nearby", () => {
    const selfToken = makeToken({ id: 'self', disposition: 1 });
    canvas.tokens.placeables = [selfToken];

    const actor = { getActiveTokens: jest.fn(() => [selfToken]) };

    activateWhirlwindStrike(actor);

    expect(canvas.tokens.setTargets).toHaveBeenCalledWith([]);
  });
});
