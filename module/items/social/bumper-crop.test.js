import { jest } from '@jest/globals';
import { activateBumperCrop, applyBumperCropSnag } from './bumper-crop.mjs';

global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 10 })) },
};
global.game = { combat: null };

describe("activateBumperCrop", () => {
  test("rolls Intimidation against a flat DIF 10", async () => {
    const actor = { _dice: { rollSkill: jest.fn() } };

    await activateBumperCrop(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'intimidation', essence: 'strength', dif: '10', isBumperCrop: true }),
      actor,
    );
  });
});

describe("applyBumperCropSnag", () => {
  function makeEnemyToken(disposition, id) {
    return {
      document: { disposition }, center: {},
      actor: { id, setFlag: jest.fn() },
    };
  }

  test("affects only 1 enemy at margin 0", async () => {
    const actorToken = { document: { disposition: 1 }, center: {} };
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    const enemy1 = makeEnemyToken(-1, 'e1');
    const enemy2 = makeEnemyToken(-1, 'e2');
    canvas.tokens.placeables = [actorToken, enemy1, enemy2];

    await applyBumperCropSnag(actor, 0);

    expect(enemy1.actor.setFlag).toHaveBeenCalledWith('essence20', 'pendingBumperCropSnag', expect.objectContaining({ snag: true }));
    expect(enemy2.actor.setFlag).not.toHaveBeenCalled();
  });

  test("affects one additional enemy per 5 points of margin", async () => {
    const actorToken = { document: { disposition: 1 }, center: {} };
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    const enemy1 = makeEnemyToken(-1, 'e1');
    const enemy2 = makeEnemyToken(-1, 'e2');
    const enemy3 = makeEnemyToken(-1, 'e3');
    canvas.tokens.placeables = [actorToken, enemy1, enemy2, enemy3];

    await applyBumperCropSnag(actor, 10); // 1 + floor(10/5) = 3 targets

    expect(enemy1.actor.setFlag).toHaveBeenCalled();
    expect(enemy2.actor.setFlag).toHaveBeenCalled();
    expect(enemy3.actor.setFlag).toHaveBeenCalled();
  });

  test("doesn't affect allies (same disposition)", async () => {
    const actorToken = { document: { disposition: 1 }, center: {} };
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    const ally = makeEnemyToken(1, 'a1');
    canvas.tokens.placeables = [actorToken, ally];

    await applyBumperCropSnag(actor, 0);

    expect(ally.actor.setFlag).not.toHaveBeenCalled();
  });
});
