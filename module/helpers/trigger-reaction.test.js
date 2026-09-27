import { jest } from '@jest/globals';
import { activateTriggerReaction } from './trigger-reaction.mjs';

global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

describe("activateTriggerReaction", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("rolls the chosen skill vs DIF 5", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('survival');
    const actor = { _dice: { rollSkill: jest.fn() } };

    await activateTriggerReaction(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'survival', essence: 'smarts', dif: '5' }),
      actor,
    );
  });

  test("rolls Science when that's the chosen skill", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('science');
    const actor = { _dice: { rollSkill: jest.fn() } };

    await activateTriggerReaction(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'science', essence: 'smarts', dif: '5' }),
      actor,
    );
  });

  test("does nothing when the skill picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = { _dice: { rollSkill: jest.fn() } };

    await activateTriggerReaction(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});
