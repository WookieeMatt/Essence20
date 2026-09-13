import { jest } from '@jest/globals';
import { autoTargetExplosiveBeam } from './explosive-beam.mjs';

describe("autoTargetExplosiveBeam", () => {
  test("targets every enemy within 60ft", () => {
    const actorToken = { document: { disposition: 1 }, center: { x: 0, y: 0 } };
    const enemyToken = { id: 'enemy1', document: { disposition: -1 }, actor: {}, center: { x: 10, y: 0 } };
    global.canvas = {
      tokens: { placeables: [actorToken, enemyToken], setTargets: jest.fn() },
      grid: { measurePath: () => ({ distance: 10 }) },
    };
    const actor = { getActiveTokens: () => [actorToken] };

    autoTargetExplosiveBeam(actor);

    expect(global.canvas.tokens.setTargets).toHaveBeenCalledWith(['enemy1']);
  });
});
