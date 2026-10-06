import { jest } from '@jest/globals';
import { autoTargetBeamVolley } from './beam-volley.mjs';

describe("autoTargetBeamVolley", () => {
  test("targets the 3 closest enemies", () => {
    const actorToken = { document: { disposition: 1 }, center: { x: 0, y: 0 } };
    const enemies = [
      { id: 'far', document: { disposition: -1 }, actor: {}, center: { x: 40, y: 0 } },
      { id: 'near', document: { disposition: -1 }, actor: {}, center: { x: 10, y: 0 } },
      { id: 'mid', document: { disposition: -1 }, actor: {}, center: { x: 20, y: 0 } },
      { id: 'extra', document: { disposition: -1 }, actor: {}, center: { x: 30, y: 0 } },
    ];
    global.canvas = {
      tokens: { placeables: [actorToken, ...enemies], setTargets: jest.fn() },
      grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) },
    };
    const actor = { getActiveTokens: () => [actorToken] };

    autoTargetBeamVolley(actor);

    expect(global.canvas.tokens.setTargets).toHaveBeenCalledWith(['near', 'mid', 'extra']);
  });
});
