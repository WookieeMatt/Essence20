import { jest } from '@jest/globals';
import {
  activateTwoHeadsAreBetterThanOne, canUseTwoHeadsAreBetterThanOne, checkTwoHeadsAssistance,
  consumeTwoHeadsAssistance,
} from './two-heads-are-better-than-one.mjs';

global.game = { user: { targets: { first: jest.fn() } }, combat: null };

function makeActor({ usedFlag = undefined } = {}) {
  const flagStore = { twoHeadsAssistanceUsedThisEncounter: usedFlag };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flagStore[key];
    }),
  };
}

beforeEach(() => {
  game.combat = { id: 'combat1', round: 1, turn: 0 };
  game.user.targets.first.mockReset();
});

afterEach(() => {
  game.combat = null;
});

describe("canUseTwoHeadsAreBetterThanOne", () => {
  test("true, not yet used this scene", () => {
    expect(canUseTwoHeadsAreBetterThanOne(makeActor())).toBe(true);
  });

  test("false once already used this scene", () => {
    const actor = makeActor({ usedFlag: { epoch: 1, window: 'encounter', count: 1 } });
    expect(canUseTwoHeadsAreBetterThanOne(actor)).toBe(false);
  });
});

describe("activateTwoHeadsAreBetterThanOne", () => {
  test("marks the currently-targeted actor and marks the scene used", async () => {
    const targetActor = { uuid: 'Actor.target1' };
    game.user.targets.first.mockReturnValue({ actor: targetActor });
    const actor = makeActor();

    const result = await activateTwoHeadsAreBetterThanOne(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'twoHeadsAssistanceTargetUuid', 'Actor.target1');
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'twoHeadsAssistanceUsedThisEncounter', expect.objectContaining({ epoch: 1, window: 'encounter', count: 1 }),
    );
  });

  test("does nothing (and doesn't spend the scene use) with no target selected", async () => {
    game.user.targets.first.mockReturnValue(undefined);
    const actor = makeActor();

    const result = await activateTwoHeadsAreBetterThanOne(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("checkTwoHeadsAssistance / consumeTwoHeadsAssistance", () => {
  test("true for the actor's own marked target", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (key == 'twoHeadsAssistanceTargetUuid' ? 'Actor.target1' : undefined));
    expect(checkTwoHeadsAssistance(actor, { uuid: 'Actor.target1' })).toBe(true);
  });

  test("false for a different target, or with nothing marked", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (key == 'twoHeadsAssistanceTargetUuid' ? 'Actor.target1' : undefined));
    expect(checkTwoHeadsAssistance(actor, { uuid: 'Actor.somethingElse' })).toBe(false);

    const unmarkedActor = makeActor();
    expect(checkTwoHeadsAssistance(unmarkedActor, { uuid: 'Actor.target1' })).toBe(false);
  });

  test("consumeTwoHeadsAssistance clears the actor's own mark", async () => {
    const actor = makeActor();
    await consumeTwoHeadsAssistance(actor);
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'twoHeadsAssistanceTargetUuid');
  });
});
