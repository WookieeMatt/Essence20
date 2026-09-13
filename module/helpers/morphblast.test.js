import { jest } from '@jest/globals';
import { activateMorphblast } from './morphblast.mjs';

global.canvas = { tokens: { placeables: [], setTargets: jest.fn() }, grid: { measurePath: jest.fn(() => ({ distance: 0 })) } };

describe("activateMorphblast", () => {
  test("targets nearby enemies and triggers a synthetic Athletics-vs-Evasion roll", async () => {
    const enemyToken = { id: 'enemy1', actor: {}, document: { disposition: -1 }, center: { x: 0, y: 0 } };
    const actorToken = { actor: {}, document: { disposition: 1 }, center: { x: 0, y: 0 } };
    global.canvas.tokens.placeables = [actorToken, enemyToken];
    const actor = { getActiveTokens: jest.fn(() => [actorToken]), _dice: { rollSkill: jest.fn() } };

    await activateMorphblast(actor);

    expect(global.canvas.tokens.setTargets).toHaveBeenCalledWith(['enemy1']);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'athletics', essence: 'strength', defenseType: 'evasion', isMorphblast: true }),
      actor,
    );
  });
});
