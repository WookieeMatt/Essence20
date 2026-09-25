import { jest } from '@jest/globals';
import { activateMarkEverybot, canUseMarkEverybot, checkMarkTarget, markTarget } from './mark-target.mjs';

const ADDITIONAL_MARKS_ID = "Compendium.essence20.tf_crb.Item.sapOdu2VHIJLeZdE";

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

describe("Mark Everybot (Transformers CRB, Scout, 18th level, p.85)", () => {
  function makeActor(flagStore = {}) {
    return {
      getFlag: jest.fn((scope, key) => (scope == 'essence20' ? flagStore[key] : undefined)),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
    };
  }

  describe("canUseMarkEverybot", () => {
    test("true before it's used", () => {
      expect(canUseMarkEverybot(makeActor())).toBe(true);
    });

    test("false once already used this scene", () => {
      const actor = makeActor({
        markEverybotUsedThisEncounter: { epoch: 1, window: 'encounter', count: 1 },
      });
      expect(canUseMarkEverybot(actor)).toBe(false);
    });
  });

  describe("checkMarkTarget with Mark Everybot active", () => {
    test("matches ANY target, even one never explicitly marked", async () => {
      const actor = makeActor();
      await activateMarkEverybot(actor);

      expect(checkMarkTarget(actor, { uuid: 'Actor.anyoneAtAll' })).toBe(true);
    });

    test("doesn't apply before Mark Everybot has been used", () => {
      const actor = makeActor();
      expect(checkMarkTarget(actor, { uuid: 'Actor.anyoneAtAll' })).toBe(false);
    });

    test("an ordinary single Mark Target still works without Mark Everybot", () => {
      const actor = makeActor({ markedTargetUuid: 'Actor.target1' });
      expect(checkMarkTarget(actor, { uuid: 'Actor.target1' })).toBe(true);
      expect(checkMarkTarget(actor, { uuid: 'Actor.someoneElse' })).toBe(false);
    });
  });
});

describe("Additional Marks (Transformers CRB, Scout, 14th level, p.85)", () => {
  function makeActor(flagStore = {}) {
    return {
      items: [{ type: 'perk', flags: { core: { sourceId: ADDITIONAL_MARKS_ID } } }],
      getFlag: jest.fn((scope, key) => (scope == 'essence20' ? flagStore[key] : undefined)),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
    };
  }

  beforeEach(() => {
    game.user.targets.first.mockReset();
  });

  test("markTarget appends to a list instead of overwriting the single designee", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue({ actor: { uuid: 'Actor.target1' } });
    await markTarget(actor);
    game.user.targets.first.mockReturnValue({ actor: { uuid: 'Actor.target2' } });
    await markTarget(actor);

    expect(checkMarkTarget(actor, { uuid: 'Actor.target1' })).toBe(true);
    expect(checkMarkTarget(actor, { uuid: 'Actor.target2' })).toBe(true);
    expect(checkMarkTarget(actor, { uuid: 'Actor.someoneElse' })).toBe(false);
  });

  test("drops the oldest designee past the 5-target limit", async () => {
    const actor = makeActor();
    for (let i = 1; i <= 6; i++) {
      game.user.targets.first.mockReturnValue({ actor: { uuid: `Actor.target${i}` } });
      await markTarget(actor);
    }

    expect(checkMarkTarget(actor, { uuid: 'Actor.target1' })).toBe(false);
    expect(checkMarkTarget(actor, { uuid: 'Actor.target6' })).toBe(true);
  });

  test("re-marking an already-marked target doesn't duplicate it in the list", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue({ actor: { uuid: 'Actor.target1' } });
    await markTarget(actor);
    await markTarget(actor);

    const list = actor.getFlag('essence20', 'additionalMarkedTargetUuids');
    expect(list).toEqual(['Actor.target1']);
  });
});
