import { jest } from '@jest/globals';
import { activateTalkThemDown } from './talk-them-down.mjs';

global.game = { i18n: { localize: (k) => k }, user: { targets: { first: jest.fn() } } };
global.ui = { notifications: { warn: jest.fn() } };

function makeActor(level) {
  return { system: { level }, _dice: { rollSkill: jest.fn() } };
}

function makeTarget({ health = 10, max = 10, level = 1 } = {}) {
  return { system: { health: { value: health, max }, level } };
}

describe("activateTalkThemDown", () => {
  beforeEach(() => {
    ui.notifications.warn.mockReset();
  });

  test("rolls Persuasion vs Willpower when eligible (>=half damage, lower Threat Level)", async () => {
    const targetActor = makeTarget({ health: 5, max: 10, level: 3 });
    game.user.targets.first.mockReturnValue({ actor: targetActor });
    const actor = makeActor(10);

    await activateTalkThemDown(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'persuasion', essence: 'social', defenseType: 'willpower', isTalkThemDownFgtaa: true,
      }),
      actor,
    );
  });

  test("warns and does nothing without a target", async () => {
    game.user.targets.first.mockReturnValue(undefined);
    const actor = makeActor(10);

    await activateTalkThemDown(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("warns and does nothing when the target hasn't taken half damage", async () => {
    const targetActor = makeTarget({ health: 8, max: 10, level: 3 });
    game.user.targets.first.mockReturnValue({ actor: targetActor });
    const actor = makeActor(10);

    await activateTalkThemDown(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("warns and does nothing when the target's Threat Level isn't lower", async () => {
    const targetActor = makeTarget({ health: 5, max: 10, level: 10 });
    game.user.targets.first.mockReturnValue({ actor: targetActor });
    const actor = makeActor(10);

    await activateTalkThemDown(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});
