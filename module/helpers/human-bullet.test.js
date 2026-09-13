import { jest } from '@jest/globals';
import { activateHumanBullet, pickHumanBulletRadius } from './human-bullet.mjs';

global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
global.canvas = {
  tokens: { placeables: [], setTargets: jest.fn() },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

function makeActor() {
  return {
    getActiveTokens: jest.fn(() => [{ center: { x: 0, y: 0 }, document: { disposition: 1 } }]),
    _dice: { rollSkill: jest.fn() },
  };
}

beforeEach(() => {
  foundry.applications.api.DialogV2.wait.mockReset();
  canvas.tokens.setTargets.mockReset();
  canvas.tokens.placeables = [];
});

describe("pickHumanBulletRadius", () => {
  test("returns the chosen radius as a number", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('10');
    expect(await pickHumanBulletRadius()).toBe(10);
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickHumanBulletRadius()).toBeNull();
  });
});

describe("activateHumanBullet", () => {
  test("does nothing when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();

    await activateHumanBullet(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("30ft radius rolls with 1 Fire damage", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('30');
    const actor = makeActor();

    await activateHumanBullet(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ isHumanBullet: true, humanBulletDamage: 1, defenseType: 'evasion' }),
      actor,
    );
  });

  test("10ft radius rolls with 2 Fire damage", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('10');
    const actor = makeActor();

    await activateHumanBullet(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ humanBulletDamage: 2 }),
      actor,
    );
  });
});
