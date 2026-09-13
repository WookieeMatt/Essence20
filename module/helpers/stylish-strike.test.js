import { jest } from '@jest/globals';
import { applyStylishStrike } from './stylish-strike.mjs';

global.canvas = { tokens: { placeables: [] }, grid: { measurePath: jest.fn(() => ({ distance: 0 })) } };

function makeAlly(statuses = []) {
  return {
    statuses: new Set(statuses),
    toggleStatusEffect: jest.fn(async function (condition) { this.statuses.delete(condition); }),
  };
}

function makeActorToken(actor, disposition = 1) {
  return { actor, document: { disposition }, center: { x: 0, y: 0 } };
}

describe("applyStylishStrike", () => {
  test("removes Frightened/Impaired/Mesmerized from every nearby ally", async () => {
    const ally1 = makeAlly(['frightened', 'impaired']);
    const ally2 = makeAlly(['mesmerized']);
    const actorToken = makeActorToken({}, 1);
    global.canvas.tokens.placeables = [actorToken, makeActorToken(ally1, 1), makeActorToken(ally2, 1)];
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };

    await applyStylishStrike(actor);

    expect(ally1.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
    expect(ally1.toggleStatusEffect).toHaveBeenCalledWith('impaired', { active: false });
    expect(ally2.toggleStatusEffect).toHaveBeenCalledWith('mesmerized', { active: false });
  });

  test("doesn't touch an ally with none of the 3 conditions, or an enemy-disposition token", async () => {
    const cleanAlly = makeAlly([]);
    const enemy = makeAlly(['frightened']);
    const actorToken = makeActorToken({}, 1);
    global.canvas.tokens.placeables = [actorToken, makeActorToken(cleanAlly, 1), makeActorToken(enemy, -1)];
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };

    await applyStylishStrike(actor);

    expect(cleanAlly.toggleStatusEffect).not.toHaveBeenCalled();
    expect(enemy.toggleStatusEffect).not.toHaveBeenCalled();
  });
});
