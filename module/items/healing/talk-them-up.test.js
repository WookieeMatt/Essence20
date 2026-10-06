import { jest } from '@jest/globals';
import { activateTalkThemUp, pickTalkThemUpCondition, applyTalkThemUp } from './talk-them-up.mjs';

global.game = { i18n: { localize: (k) => k }, user: { targets: { first: jest.fn() } } };
global.ui = { notifications: { warn: jest.fn() } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

describe("activateTalkThemUp", () => {
  beforeEach(() => {
    ui.notifications.warn.mockReset();
  });

  test("rolls Persuasion at flat DIF 10 against the current target", async () => {
    const targetActor = { uuid: 'Actor.target1' };
    game.user.targets.first.mockReturnValue({ actor: targetActor });
    const actor = { _dice: { rollSkill: jest.fn() } };

    await activateTalkThemUp(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'persuasion', essence: 'social', dif: 10, isTalkThemUp: true,
        talkThemUpTargetUuid: 'Actor.target1',
      }),
      actor,
    );
  });

  test("warns and does nothing with no target", async () => {
    game.user.targets.first.mockReturnValue(undefined);
    const actor = { _dice: { rollSkill: jest.fn() } };

    await activateTalkThemUp(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("pickTalkThemUpCondition", () => {
  test("warns and returns null when the target has no removable Condition", async () => {
    const targetActor = { statuses: new Set(['defeated']) };
    const result = await pickTalkThemUpCondition(targetActor);
    expect(result).toBeNull();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("returns the chosen status", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('blinded');
    const targetActor = { statuses: new Set(['blinded', 'defeated']) };
    const result = await pickTalkThemUpCondition(targetActor);
    expect(result).toBe('blinded');
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const targetActor = { statuses: new Set(['blinded']) };
    const result = await pickTalkThemUpCondition(targetActor);
    expect(result).toBeNull();
  });
});

describe("applyTalkThemUp", () => {
  test("removes the chosen status from the target", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('blinded');
    const targetActor = { statuses: new Set(['blinded']), toggleStatusEffect: jest.fn() };

    await applyTalkThemUp(targetActor);

    expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('blinded', { active: false });
  });

  test("does nothing when nothing was chosen", async () => {
    const targetActor = { statuses: new Set(['defeated']), toggleStatusEffect: jest.fn() };

    await applyTalkThemUp(targetActor);

    expect(targetActor.toggleStatusEffect).not.toHaveBeenCalled();
  });
});
