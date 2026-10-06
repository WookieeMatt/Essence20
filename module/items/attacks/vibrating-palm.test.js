import { jest } from '@jest/globals';
import { activateVibratingPalm, canUseVibratingPalm } from './vibrating-palm.mjs';

global.game = {
  i18n: { localize: (k) => k },
  user: { targets: { first: jest.fn(() => undefined) } },
  settings: { get: jest.fn(() => 0) },
  users: [{ isGM: true, active: true }],
  socket: { emit: jest.fn() },
};

global.ui = { notifications: { warn: jest.fn() } };

function mockStoryPoints(value) {
  game.actors = { party: { isOwner: false, system: { storyPoints: value, gmPoints: 0 } } };
}

function makeActor() {
  return {
    update: jest.fn(),
    toggleStatusEffect: jest.fn(),
  };
}

describe("canUseVibratingPalm", () => {
  test("true with a Story Point available", () => {
    mockStoryPoints(1);
    expect(canUseVibratingPalm(makeActor())).toBe(true);
  });

  test("false with no Story Points available", () => {
    mockStoryPoints(0);
    expect(canUseVibratingPalm(makeActor())).toBe(false);
  });
});

describe("activateVibratingPalm", () => {
  beforeEach(() => {
    game.user.targets.first.mockReset();
    ui.notifications.warn.mockClear();
    game.socket.emit.mockClear();
    mockStoryPoints(1);
  });

  test("spends the Story Point and Defeats the currently-targeted actor", async () => {
    const actor = makeActor();
    const target = makeActor();
    game.user.targets.first.mockReturnValue({ actor: target });

    const activated = await activateVibratingPalm(actor);

    expect(activated).toBe(true);
    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', expect.objectContaining({
      action: 'spendStoryPoints', amount: 1,
    }));
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
    expect(target.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: true });
  });

  test("warns and does nothing with no Story Point available", async () => {
    mockStoryPoints(0);
    const actor = makeActor();
    const target = makeActor();
    game.user.targets.first.mockReturnValue({ actor: target });

    const activated = await activateVibratingPalm(actor);

    expect(activated).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.VibratingPalmNoStoryPoint');
    expect(target.update).not.toHaveBeenCalled();
  });

  test("warns and does nothing with no target", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(undefined);

    const activated = await activateVibratingPalm(actor);

    expect(activated).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.VibratingPalmNoTarget');
  });

  test("doesn't spend the Story Point when no GM is connected", async () => {
    game.users = [{ isGM: false, active: true }];
    const actor = makeActor();
    const target = makeActor();
    game.user.targets.first.mockReturnValue({ actor: target });

    const activated = await activateVibratingPalm(actor);

    expect(activated).toBe(true);
    expect(game.socket.emit).not.toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
    game.users = [{ isGM: true, active: true }];
  });
});
