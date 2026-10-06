import { jest } from '@jest/globals';
import { activateDeadstick, pickDeadstickDefenseType } from './deadstick.mjs';

global.game = {
  i18n: { localize: (key) => key },
  user: { targets: { first: jest.fn(() => undefined) } },
};

global.ui = { notifications: { warn: jest.fn() } };

global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor() {
  return { _dice: { rollSkill: jest.fn() } };
}

describe("pickDeadstickDefenseType", () => {
  test("returns the chosen Defense", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cleverness');
    expect(await pickDeadstickDefenseType()).toBe('cleverness');
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickDeadstickDefenseType()).toBeNull();
  });
});

describe("activateDeadstick", () => {
  beforeEach(() => {
    ui.notifications.warn.mockClear();
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("triggers a Technology roll against the chosen Defense", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue({ actor: {} });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('willpower');

    await activateDeadstick(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'technology', defenseType: 'willpower', isDeadstick: true }), actor,
    );
  });

  test("warns and does nothing without a target", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(undefined);

    await activateDeadstick(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("does nothing when the picker is cancelled", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue({ actor: {} });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');

    await activateDeadstick(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});
