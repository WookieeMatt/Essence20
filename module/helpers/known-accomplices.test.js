import { jest } from '@jest/globals';
import { checkKnownAccomplice, designateKnownAccomplice } from './known-accomplices.mjs';

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

describe("designateKnownAccomplice (Decepticon Directive p.55/56)", () => {
  beforeEach(() => {
    game.user.targets.first.mockReset();
    ui.notifications.warn.mockClear();
  });

  test("spends 1 Energon Point and sets the actor's flag to the currently-targeted token's actor uuid", async () => {
    const actor = { setFlag: jest.fn(), update: jest.fn(), system: { energon: { normal: { value: 2 } } } };
    const targetActor = { uuid: 'Actor.target1' };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await designateKnownAccomplice(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.energon.normal.value': 1 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'knownAccompliceUuid', 'Actor.target1');
    expect(result).toBe(true);
  });

  test("warns and does nothing when nothing is targeted", async () => {
    const actor = { setFlag: jest.fn(), update: jest.fn(), system: { energon: { normal: { value: 2 } } } };
    game.user.targets.first.mockReturnValue(undefined);

    const result = await designateKnownAccomplice(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.KnownAccomplicesNoTarget');
    expect(result).toBe(false);
  });
});

describe("checkKnownAccomplice", () => {
  test("true when the target's uuid matches the actor's Known Accomplice", () => {
    const actor = { getFlag: jest.fn(() => 'Actor.target1') };
    const target = { uuid: 'Actor.target1' };
    expect(checkKnownAccomplice(actor, target)).toBe(true);
  });

  test("false when the target's uuid doesn't match", () => {
    const actor = { getFlag: jest.fn(() => 'Actor.target1') };
    const target = { uuid: 'Actor.someoneElse' };
    expect(checkKnownAccomplice(actor, target)).toBe(false);
  });

  test("false when the actor has no Known Accomplice designated at all", () => {
    const actor = { getFlag: jest.fn(() => undefined) };
    const target = { uuid: 'Actor.target1' };
    expect(checkKnownAccomplice(actor, target)).toBe(false);
  });

  test("false when there's no target", () => {
    const actor = { getFlag: jest.fn(() => 'Actor.target1') };
    expect(checkKnownAccomplice(actor, null)).toBe(false);
  });

  test("false when both the designated flag and the target's uuid are undefined (loose-equality regression guard)", () => {
    const actor = { getFlag: jest.fn(() => undefined) };
    const target = { uuid: undefined };
    expect(checkKnownAccomplice(actor, target)).toBe(false);
  });

  test("false when the actor has no getFlag method at all", () => {
    const target = { uuid: 'Actor.target1' };
    expect(checkKnownAccomplice({}, target)).toBe(false);
  });
});
