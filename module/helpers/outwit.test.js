import { jest } from '@jest/globals';
import { activateOutwit, pickOutwitSkill } from './outwit.mjs';

global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

describe("pickOutwitSkill", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("returns the chosen skill", () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('intimidation');
    return expect(pickOutwitSkill()).resolves.toBe('intimidation');
  });

  test("returns null when cancelled", () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    return expect(pickOutwitSkill()).resolves.toBeNull();
  });
});

describe("activateOutwit", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("rolls Deception vs Cleverness, flagged to Stun", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('deception');
    const actor = { _dice: { rollSkill: jest.fn() } };

    const activated = await activateOutwit(actor);

    expect(activated).toBe(true);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'deception', essence: 'social', defenseType: 'cleverness',
        isOutwit: true, outwitCondition: 'stunned',
      }),
      actor,
    );
  });

  test("rolls Intimidation vs Willpower, flagged to Frighten", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('intimidation');
    const actor = { _dice: { rollSkill: jest.fn() } };

    await activateOutwit(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'intimidation', essence: 'social', defenseType: 'willpower',
        isOutwit: true, outwitCondition: 'frightened',
      }),
      actor,
    );
  });

  test("doesn't roll anything when the picker is cancelled, returning false", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = { _dice: { rollSkill: jest.fn() } };

    const activated = await activateOutwit(actor);

    expect(activated).toBe(false);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});
