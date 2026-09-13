import { jest } from '@jest/globals';
import { checkMarkTarget, markTarget } from './mark-target.mjs';

global.game = {
  i18n: {
    localize: (key) => key,
  },
  user: {
    targets: {
      first: jest.fn(() => undefined),
    },
  },
};

global.ui = {
  notifications: {
    warn: jest.fn(),
  },
};

/* markTarget */
describe("markTarget", () => {
  beforeEach(() => {
    game.user.targets.first.mockReset();
    ui.notifications.warn.mockClear();
  });

  test("sets the actor's flag to the currently-targeted token's actor uuid", async () => {
    const actor = { setFlag: jest.fn() };
    const targetActor = { uuid: 'Actor.target1' };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await markTarget(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'markedTargetUuid', 'Actor.target1');
    expect(result).toBe(true);
  });

  test("warns and does nothing when nothing is targeted", async () => {
    const actor = { setFlag: jest.fn() };
    game.user.targets.first.mockReturnValue(undefined);

    const result = await markTarget(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.MarkTargetNoTarget');
    expect(result).toBe(false);
  });

  test("warns and does nothing when the targeted token has no actor", async () => {
    const actor = { setFlag: jest.fn() };
    game.user.targets.first.mockReturnValue({ actor: null });

    const result = await markTarget(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.MarkTargetNoTarget');
    expect(result).toBe(false);
  });
});

/* checkMarkTarget */
describe("checkMarkTarget", () => {
  test("true when the target's uuid matches the actor's marked target", () => {
    const actor = { getFlag: jest.fn(() => 'Actor.target1') };
    const target = { uuid: 'Actor.target1' };
    expect(checkMarkTarget(actor, target)).toBe(true);
  });

  test("false when the target's uuid doesn't match", () => {
    const actor = { getFlag: jest.fn(() => 'Actor.target1') };
    const target = { uuid: 'Actor.someoneElse' };
    expect(checkMarkTarget(actor, target)).toBe(false);
  });

  test("false when the actor has no marked target at all", () => {
    const actor = { getFlag: jest.fn(() => undefined) };
    const target = { uuid: 'Actor.target1' };
    expect(checkMarkTarget(actor, target)).toBe(false);
  });

  test("false when there's no target", () => {
    const actor = { getFlag: jest.fn(() => 'Actor.target1') };
    expect(checkMarkTarget(actor, null)).toBe(false);
  });

  test("false when both the marked flag and the target's uuid are undefined (loose-equality regression guard)", () => {
    const actor = { getFlag: jest.fn(() => undefined) };
    const target = { uuid: undefined };
    expect(checkMarkTarget(actor, target)).toBe(false);
  });

  test("false when the actor has no getFlag method at all", () => {
    const target = { uuid: 'Actor.target1' };
    expect(checkMarkTarget({}, target)).toBe(false);
  });
});
