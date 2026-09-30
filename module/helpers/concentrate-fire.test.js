import { jest } from '@jest/globals';
import { isConcentrateFireTarget, markConcentrateFireTarget } from './concentrate-fire.mjs';

function makeActor(uuid, flags = {}) {
  return {
    uuid,
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flags[key];
    }),
  };
}

let targeted = null;
beforeEach(() => {
  targeted = null;
  // No settings registered, so the scene clock reads its default epoch of 1.
  global.game = {
    user: { targets: { first: () => (targeted ? { actor: targeted } : undefined) } },
    i18n: { localize: key => key },
  };
  global.ui = { notifications: { warn: jest.fn() } };
  global.fromUuid = jest.fn();
});

describe("markConcentrateFireTarget", () => {
  test("warns and marks nothing with no target", async () => {
    expect(await markConcentrateFireTarget(makeActor('Actor.me'))).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("marks the target for this encounter and remembers it on the designator", async () => {
    const me = makeActor('Actor.me');
    targeted = makeActor('Actor.enemy');

    expect(await markConcentrateFireTarget(me)).toBe(true);
    expect(targeted.setFlag).toHaveBeenCalledWith('essence20', 'concentrateFireTargetMark',
      { epoch: 1, window: 'encounter', count: 1, by: 'Actor.me' });
    expect(me.setFlag).toHaveBeenCalledWith('essence20', 'concentrateFireDesignee', 'Actor.enemy');
    expect(isConcentrateFireTarget(targeted)).toBe(true);
  });

  test("designating a new target clears the previous one", async () => {
    const old = makeActor('Actor.old', { concentrateFireTargetMark: { epoch: 1, window: 'encounter', count: 1 } });
    const me = makeActor('Actor.me', { concentrateFireDesignee: 'Actor.old' });
    fromUuid.mockResolvedValue(old);
    targeted = makeActor('Actor.enemy');

    await markConcentrateFireTarget(me);

    expect(old.unsetFlag).toHaveBeenCalledWith('essence20', 'concentrateFireTargetMark');
    expect(isConcentrateFireTarget(old)).toBe(false);
  });
});

describe("isConcentrateFireTarget", () => {
  test("false once the encounter has moved on, for an old bare `true`, or unmarked", () => {
    expect(isConcentrateFireTarget(makeActor('a', { concentrateFireTargetMark: { epoch: 0, window: 'encounter', count: 1 } }))).toBe(false);
    expect(isConcentrateFireTarget(makeActor('a', { concentrateFireTargetMark: true }))).toBe(false);
    expect(isConcentrateFireTarget(makeActor('a'))).toBe(false);
    expect(isConcentrateFireTarget(null)).toBe(false);
  });
});
