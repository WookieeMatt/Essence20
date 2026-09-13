import { jest } from '@jest/globals';
import { activateHeartyMeal, broadcastHeartyMeal, pickHeartyMealSkill } from './hearty-meal.mjs';

global.game = { i18n: { localize: (key) => key } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

describe("pickHeartyMealSkill", () => {
  test("returns the chosen skill and its essence", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('performance');
    expect(await pickHeartyMealSkill()).toEqual({ skill: 'performance', essence: 'social' });

    foundry.applications.api.DialogV2.wait.mockResolvedValue('culture');
    expect(await pickHeartyMealSkill()).toEqual({ skill: 'culture', essence: 'smarts' });
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickHeartyMealSkill()).toBeNull();
  });
});

describe("activateHeartyMeal", () => {
  test("prompts for a skill, then rolls the flat DIF 15 check, flagged for post-hit processing", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('culture');
    const actor = { _dice: { rollSkill: jest.fn() } };

    await activateHeartyMeal(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'culture', essence: 'smarts', dif: 15, isHeartyMeal: true }), actor,
    );
  });

  test("does nothing when the skill picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = { _dice: { rollSkill: jest.fn() } };

    await activateHeartyMeal(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("broadcastHeartyMeal", () => {
  function makeActor({ id, name = 'Actor', healthBonus = 0 } = {}) {
    return { id, name, system: { health: { bonus: healthBonus } }, update: jest.fn(), getActiveTokens: jest.fn(() => []) };
  }

  function makeToken(actor, disposition = 1) {
    return { actor, document: { disposition }, center: {} };
  }

  beforeEach(() => {
    canvas.tokens.placeables = [];
    canvas.grid.measurePath.mockReset();
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });
  });

  test("grants 1 temporary Health to the cook and every ally on the scene", async () => {
    const actor = makeActor({ id: 'cook1' });
    const ownToken = makeToken(actor, 1);
    actor.getActiveTokens = jest.fn(() => [ownToken]);
    const ally = makeActor({ id: 'ally1', name: 'Ally', healthBonus: 1 });
    const allyToken = makeToken(ally, 1);
    canvas.tokens.placeables = [ownToken, allyToken];

    await broadcastHeartyMeal(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 1 });
    expect(ally.update).toHaveBeenCalledWith({ 'system.health.bonus': 2 });
  });

  test("excludes an enemy token", async () => {
    const actor = makeActor({ id: 'cook1' });
    const ownToken = makeToken(actor, 1);
    actor.getActiveTokens = jest.fn(() => [ownToken]);
    const enemy = makeActor({ id: 'enemy1', name: 'Enemy' });
    const enemyToken = makeToken(enemy, -1);
    canvas.tokens.placeables = [ownToken, enemyToken];

    await broadcastHeartyMeal(actor);

    expect(enemy.update).not.toHaveBeenCalled();
  });
});
