import { jest } from '@jest/globals';
import {
  canDesignateProtectedTarget, designateProtectedTarget, getProtectedTargetUuid, isProtectedTarget,
} from './protected-target.mjs';

global.game = {
  i18n: {
    localize: (key) => key,
    format: (key) => key,
  },
  user: {
    targets: {
      first: jest.fn(() => undefined),
    },
  },
  combat: null,
};

global.ui = {
  notifications: {
    warn: jest.fn(),
  },
};

global.fromUuid = jest.fn();

function makeActor({ flags = {} } = {}) {
  return {
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value; 
    }),
    system: { health: { bonus: 0 } },
    update: jest.fn(async function (data) {
      this.system.health.bonus = data['system.health.bonus']; 
    }),
  };
}

beforeEach(() => {
  game.user.targets.first.mockReset();
  ui.notifications.warn.mockClear();
  global.fromUuid.mockReset();
  game.combat = { id: 'combat1' };
});

afterEach(() => {
  game.combat = null;
});

describe("getProtectedTargetUuid / isProtectedTarget", () => {
  test("reflects the stored flag", () => {
    const actor = makeActor({ flags: { protectedTargetUuid: 'Actor.target1' } });
    expect(getProtectedTargetUuid(actor)).toBe('Actor.target1');
    expect(isProtectedTarget(actor, { uuid: 'Actor.target1' })).toBe(true);
    expect(isProtectedTarget(actor, { uuid: 'Actor.other' })).toBe(false);
  });

  test("false with no protected target set", () => {
    const actor = makeActor();
    expect(isProtectedTarget(actor, { uuid: 'Actor.target1' })).toBe(false);
  });
});

describe("canDesignateProtectedTarget", () => {
  test("true when not yet used this encounter", () => {
    expect(canDesignateProtectedTarget(makeActor())).toBe(true);
  });

  test("false once already used this encounter", () => {
    const actor = makeActor({ flags: { protectedTargetUsedThisEncounter: { epoch: 1, window: 'encounter', count: 1 } } });
    expect(canDesignateProtectedTarget(actor)).toBe(false);
  });
});

describe("designateProtectedTarget", () => {
  test("marks the currently-targeted actor and grants +1 Temporary Health", async () => {
    const actor = makeActor();
    const targetActor = makeActor();
    targetActor.uuid = 'Actor.target1';
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await designateProtectedTarget(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'protectedTargetUuid', 'Actor.target1');
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'protectedTargetUsedThisEncounter', expect.objectContaining({ epoch: 1, window: 'encounter', count: 1 }),
    );
    expect(targetActor.system.health.bonus).toBe(1);
  });

  test("warns and does nothing when nothing is targeted", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(undefined);

    const result = await designateProtectedTarget(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.MarkTargetNoTarget');
  });

  test("moves the Temporary Health from the previous protected target to the new one", async () => {
    const previousTarget = makeActor();
    previousTarget.uuid = 'Actor.previous';
    previousTarget.system.health.bonus = 1;
    const newTarget = makeActor();
    newTarget.uuid = 'Actor.new';
    const actor = makeActor({ flags: { protectedTargetUuid: 'Actor.previous' } });
    global.fromUuid.mockResolvedValue(previousTarget);
    game.user.targets.first.mockReturnValue({ actor: newTarget });

    await designateProtectedTarget(actor);

    expect(previousTarget.system.health.bonus).toBe(0);
    expect(newTarget.system.health.bonus).toBe(1);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'protectedTargetUuid', 'Actor.new');
  });

  test("re-designating the same target again doesn't double the bonus", async () => {
    const targetActor = makeActor();
    targetActor.uuid = 'Actor.target1';
    targetActor.system.health.bonus = 1;
    const actor = makeActor({ flags: { protectedTargetUuid: 'Actor.target1' } });
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    await designateProtectedTarget(actor);

    expect(targetActor.update).not.toHaveBeenCalled();
    expect(targetActor.system.health.bonus).toBe(1);
  });
});
