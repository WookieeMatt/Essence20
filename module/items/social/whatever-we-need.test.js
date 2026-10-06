import { jest } from '@jest/globals';
import { checkWhateverWeNeed, markWhateverWeNeed } from './whatever-we-need.mjs';

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

function makeActor({ flag } = {}) {
  return {
    getFlag: jest.fn(() => flag),
    setFlag: jest.fn(),
  };
}

describe("markWhateverWeNeed", () => {
  beforeEach(() => {
    game.user.targets.first.mockReset();
    ui.notifications.warn.mockClear();
  });

  test("marks the currently-targeted actor's id", async () => {
    const targetActor = { id: 'target1' };
    game.user.targets.first.mockReturnValue({ actor: targetActor });
    const actor = makeActor();

    const result = await markWhateverWeNeed(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pendingWhateverWeNeedEdge', 'target1');
  });

  test("warns and returns false with nothing targeted", async () => {
    game.user.targets.first.mockReturnValue(undefined);
    const actor = makeActor();

    const result = await markWhateverWeNeed(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("checkWhateverWeNeed", () => {
  test("true for a marked target and one of the 3 named skills", () => {
    const actor = makeActor({ flag: 'target1' });
    expect(checkWhateverWeNeed(actor, { id: 'target1' }, 'alertness')).toBe(true);
    expect(checkWhateverWeNeed(actor, { id: 'target1' }, 'deception')).toBe(true);
    expect(checkWhateverWeNeed(actor, { id: 'target1' }, 'persuasion')).toBe(true);
  });

  test("false for a different Skill", () => {
    const actor = makeActor({ flag: 'target1' });
    expect(checkWhateverWeNeed(actor, { id: 'target1' }, 'athletics')).toBe(false);
  });

  test("false for a different target, or with nothing marked", () => {
    const actor = makeActor({ flag: 'target1' });
    expect(checkWhateverWeNeed(actor, { id: 'target2' }, 'alertness')).toBe(false);

    const unmarkedActor = makeActor();
    expect(checkWhateverWeNeed(unmarkedActor, { id: 'target1' }, 'alertness')).toBe(false);
  });
});
