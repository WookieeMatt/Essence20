import { jest } from '@jest/globals';
import { activateGroupStrike } from './group-strike.mjs';

global.canvas = {
  tokens: { placeables: [], setTargets: jest.fn() },
  grid: { measurePath: jest.fn(() => ({ distance: 5 })) },
};

function makeToken({ id, disposition = -1 } = {}) {
  return { id, actor: { id: `actor-${id}` }, document: { disposition }, center: {} };
}

describe("activateGroupStrike", () => {
  beforeEach(() => {
    canvas.tokens.setTargets.mockReset();
    canvas.tokens.placeables = [];
  });

  test("targets every enemy within the given area", () => {
    const selfToken = makeToken({ id: 'self', disposition: 1 });
    const enemy1 = makeToken({ id: 'e1', disposition: -1 });
    canvas.tokens.placeables = [selfToken, enemy1];

    const actor = { getActiveTokens: jest.fn(() => [selfToken]) };

    activateGroupStrike(actor, 10);

    expect(canvas.tokens.setTargets).toHaveBeenCalledWith(['e1']);
  });

  test("targets nothing when no enemies are nearby", () => {
    const selfToken = makeToken({ id: 'self', disposition: 1 });
    canvas.tokens.placeables = [selfToken];

    const actor = { getActiveTokens: jest.fn(() => [selfToken]) };

    activateGroupStrike(actor, 20);

    expect(canvas.tokens.setTargets).toHaveBeenCalledWith([]);
  });
});
