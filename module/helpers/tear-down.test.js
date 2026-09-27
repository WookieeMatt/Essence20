import { jest } from '@jest/globals';
import {
  isTearDownPending, markTearDownPending, clearTearDownPending, activateTearDown,
} from './tear-down.mjs';

global.game = {
  user: { targets: { first: jest.fn() } },
};
global.ui = { notifications: { warn: jest.fn() } };
global.game.i18n = { localize: (k) => k };

function makeActor() {
  return {
    getFlag: jest.fn(),
    setFlag: jest.fn(),
    unsetFlag: jest.fn(),
    _dice: { rollSkill: jest.fn() },
  };
}

beforeEach(() => {
  ui.notifications.warn.mockReset();
  game.user.targets.first.mockReset();
});

describe("isTearDownPending / markTearDownPending", () => {
  test("true once marked against that exact target", async () => {
    const actor = makeActor();
    let stored;
    actor.setFlag.mockImplementation(async (scope, key, value) => {
      stored = value;
    });
    actor.getFlag.mockImplementation(() => stored);

    await markTearDownPending(actor, { uuid: 'Actor.target1' });

    expect(isTearDownPending(actor, { uuid: 'Actor.target1' })).toBe(true);
    expect(isTearDownPending(actor, { uuid: 'Actor.other' })).toBe(false);
  });

  test("false with nothing pending", () => {
    const actor = makeActor();
    expect(isTearDownPending(actor, { uuid: 'Actor.target1' })).toBe(false);
  });

  test("false against a null target", () => {
    const actor = makeActor();
    actor.getFlag.mockReturnValue('Actor.target1');
    expect(isTearDownPending(actor, null)).toBe(false);
  });

  test("markTearDownPending is a no-op for a target with no uuid", async () => {
    const actor = makeActor();
    await markTearDownPending(actor, {});
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("clearTearDownPending", () => {
  test("unsets the actor's own pending flag", async () => {
    const actor = makeActor();
    await clearTearDownPending(actor);
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'tearDownTargetUuid');
  });
});

describe("activateTearDown", () => {
  test("warns and does not roll with no target", async () => {
    game.user.targets.first.mockReturnValue(undefined);
    const actor = makeActor();

    await activateTearDown(actor);

    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.TearDownNoTarget');
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("rolls Intimidation vs Willpower against the currently-targeted actor", async () => {
    const targetActor = { uuid: 'Actor.target1' };
    game.user.targets.first.mockReturnValue({ actor: targetActor });
    const actor = makeActor();

    await activateTearDown(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'intimidation', defenseType: 'willpower', isTearDown: true }),
      actor,
    );
  });
});
