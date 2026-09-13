import { jest } from '@jest/globals';
import { applySparkleBlast } from './sparkle-blast.mjs';

global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 5 })) },
};

function makeToken({ id, disposition = -1 } = {}) {
  return { id, actor: { id: `actor-${id}`, toggleStatusEffect: jest.fn() }, document: { disposition }, center: {} };
}

describe("applySparkleBlast", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
  });

  test("Blinds every nearby enemy", async () => {
    const selfToken = makeToken({ id: 'self', disposition: 1 });
    const enemy1 = makeToken({ id: 'e1', disposition: -1 });
    const enemy2 = makeToken({ id: 'e2', disposition: -1 });
    canvas.tokens.placeables = [selfToken, enemy1, enemy2];

    const actor = { getActiveTokens: jest.fn(() => [selfToken]) };

    await applySparkleBlast(actor);

    expect(enemy1.actor.toggleStatusEffect).toHaveBeenCalledWith('blinded', { active: true });
    expect(enemy2.actor.toggleStatusEffect).toHaveBeenCalledWith('blinded', { active: true });
  });

  test("does nothing when no enemies are nearby", async () => {
    const selfToken = makeToken({ id: 'self', disposition: 1 });
    canvas.tokens.placeables = [selfToken];

    const actor = { getActiveTokens: jest.fn(() => [selfToken]) };

    await expect(applySparkleBlast(actor)).resolves.not.toThrow();
  });
});
