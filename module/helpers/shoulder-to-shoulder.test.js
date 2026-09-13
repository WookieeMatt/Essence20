import { jest } from '@jest/globals';
import { activateShoulderToShoulder, pickShoulderToShoulderSkill } from './shoulder-to-shoulder.mjs';

global.game = {
  i18n: { localize: (k) => k, format: (k) => k },
  user: { targets: { first: jest.fn() } },
  combat: null,
};
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
global.ui = { notifications: { warn: jest.fn() } };

describe("pickShoulderToShoulderSkill", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("returns the chosen skill", () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('persuasion');
    return expect(pickShoulderToShoulderSkill()).resolves.toBe('persuasion');
  });

  test("returns null when cancelled", () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    return expect(pickShoulderToShoulderSkill()).resolves.toBeNull();
  });
});

describe("activateShoulderToShoulder", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
    game.user.targets.first.mockReset();
    ui.notifications.warn.mockReset();
  });

  test("banks the chosen skill's upshift on the currently-targeted ally", async () => {
    const targetActor = { setFlag: jest.fn() };
    game.user.targets.first.mockReturnValue({ actor: targetActor });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('persuasion');
    const actor = {};

    const activated = await activateShoulderToShoulder(actor);

    expect(activated).toBe(true);
    expect(targetActor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingShoulderToShoulder', expect.objectContaining({ skill: 'persuasion', shiftUp: 1 }),
    );
  });

  test("warns and banks nothing without a target", async () => {
    game.user.targets.first.mockReturnValue(undefined);
    const actor = {};

    const activated = await activateShoulderToShoulder(actor);

    expect(activated).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("banks nothing when the picker is cancelled", async () => {
    const targetActor = { setFlag: jest.fn() };
    game.user.targets.first.mockReturnValue({ actor: targetActor });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = {};

    const activated = await activateShoulderToShoulder(actor);

    expect(activated).toBe(false);
    expect(targetActor.setFlag).not.toHaveBeenCalled();
  });
});
