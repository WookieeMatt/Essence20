import { jest } from '@jest/globals';
import { checkPrimaryQuarry, designatePrimaryQuarry } from './primary-quarry.mjs';

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

describe("designatePrimaryQuarry (Decepticon Directive p.55)", () => {
  beforeEach(() => {
    game.user.targets.first.mockReset();
    ui.notifications.warn.mockClear();
  });

  test("sets the actor's flag to the currently-targeted token's actor uuid", async () => {
    const actor = { setFlag: jest.fn() };
    const targetActor = { uuid: 'Actor.target1' };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await designatePrimaryQuarry(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'primaryQuarryUuid', 'Actor.target1');
    expect(result).toBe(true);
  });

  test("warns and does nothing when nothing is targeted", async () => {
    const actor = { setFlag: jest.fn() };
    game.user.targets.first.mockReturnValue(undefined);

    const result = await designatePrimaryQuarry(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.PrimaryQuarryNoTarget');
    expect(result).toBe(false);
  });
});

describe("checkPrimaryQuarry", () => {
  test("true when the target's uuid matches the actor's Primary Quarry", () => {
    const actor = { getFlag: jest.fn(() => 'Actor.target1') };
    const target = { uuid: 'Actor.target1' };
    expect(checkPrimaryQuarry(actor, target)).toBe(true);
  });

  test("false when the target's uuid doesn't match", () => {
    const actor = { getFlag: jest.fn(() => 'Actor.target1') };
    const target = { uuid: 'Actor.someoneElse' };
    expect(checkPrimaryQuarry(actor, target)).toBe(false);
  });

  test("false when the actor has no Primary Quarry designated at all", () => {
    const actor = { getFlag: jest.fn(() => undefined) };
    const target = { uuid: 'Actor.target1' };
    expect(checkPrimaryQuarry(actor, target)).toBe(false);
  });

  test("false when there's no target", () => {
    const actor = { getFlag: jest.fn(() => 'Actor.target1') };
    expect(checkPrimaryQuarry(actor, null)).toBe(false);
  });

  test("false when both the designated flag and the target's uuid are undefined (loose-equality regression guard)", () => {
    const actor = { getFlag: jest.fn(() => undefined) };
    const target = { uuid: undefined };
    expect(checkPrimaryQuarry(actor, target)).toBe(false);
  });

  test("false when the actor has no getFlag method at all", () => {
    const target = { uuid: 'Actor.target1' };
    expect(checkPrimaryQuarry({}, target)).toBe(false);
  });
});
