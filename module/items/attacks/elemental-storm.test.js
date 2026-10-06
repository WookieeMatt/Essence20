import { jest } from '@jest/globals';
import { activateElementalStorm, pickElementalStormCondition } from './elemental-storm.mjs';

global.canvas = {
  tokens: { placeables: [], setTargets: jest.fn() },
  grid: { measurePath: jest.fn(() => ({ distance: 5 })) },
};
global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeToken({ id, disposition = -1 } = {}) {
  return { id, actor: { id: `actor-${id}` }, document: { disposition }, center: {} };
}

describe("pickElementalStormCondition", () => {
  test("returns the chosen Condition", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('deafened');
    expect(await pickElementalStormCondition()).toBe('deafened');
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickElementalStormCondition()).toBeNull();
  });

  test("returns null when the dialog is closed with no selection at all", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(null);
    expect(await pickElementalStormCondition()).toBeNull();
  });
});

describe("activateElementalStorm", () => {
  beforeEach(() => {
    canvas.tokens.setTargets.mockReset();
    canvas.tokens.placeables = [];
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("targets every nearby enemy and rolls Survival vs. Toughness with the chosen Condition, returning true", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('blinded');
    const selfToken = makeToken({ id: 'self', disposition: 1 });
    const enemy1 = makeToken({ id: 'e1', disposition: -1 });
    const enemy2 = makeToken({ id: 'e2', disposition: -1 });
    canvas.tokens.placeables = [selfToken, enemy1, enemy2];

    const actor = {
      getActiveTokens: jest.fn(() => [selfToken]),
      _dice: { rollSkill: jest.fn() },
    };

    const activated = await activateElementalStorm(actor);

    expect(activated).toBe(true);
    expect(canvas.tokens.setTargets).toHaveBeenCalledWith(['e1', 'e2']);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'survival', essence: 'smarts', defenseType: 'toughness',
        isElementalStorm: true, elementalStormCondition: 'blinded',
      }),
      actor,
    );
  });

  test("doesn't target anyone or roll when the Condition picker is cancelled, returning false", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const selfToken = makeToken({ id: 'self', disposition: 1 });
    canvas.tokens.placeables = [selfToken];

    const actor = {
      getActiveTokens: jest.fn(() => [selfToken]),
      _dice: { rollSkill: jest.fn() },
    };

    const activated = await activateElementalStorm(actor);

    expect(activated).toBe(false);
    expect(canvas.tokens.setTargets).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});
