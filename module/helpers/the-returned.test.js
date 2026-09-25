import { jest } from '@jest/globals';
import { activateTheReturned, canUseTheReturned } from './the-returned.mjs';

global.game = { i18n: { localize: (k) => k }, scenes: { current: { id: 'scene1' } } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor({ usedFlags = {} } = {}) {
  return {
    getFlag: jest.fn((scope, key) => (scope == 'essence20' ? usedFlags[key] : undefined)),
    setFlag: jest.fn(async (scope, key, value) => {
      usedFlags[key] = value;
    }),
  };
}

describe("canUseTheReturned", () => {
  test("true when not yet used this scene", () => {
    expect(canUseTheReturned(makeActor())).toBe(true);
  });

  test("false once already used this scene", () => {
    const usedFlags = { theReturnedUsesThisScene: { epoch: 1, window: 'scene', count: 1 } };
    expect(canUseTheReturned(makeActor({ usedFlags }))).toBe(false);
  });
});

describe("activateTheReturned", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("banks an Edge on the chosen Skill and marks the scene used", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('culture');
    const actor = makeActor();

    await activateTheReturned(actor);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingTheReturned', expect.objectContaining({ skill: 'culture' }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'theReturnedUsesThisScene', expect.objectContaining({ count: 1 }),
    );
  });

  test("does nothing when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();

    await activateTheReturned(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("does nothing once already used this scene", async () => {
    const usedFlags = { theReturnedUsesThisScene: { epoch: 1, window: 'scene', count: 1 } };
    const actor = makeActor({ usedFlags });

    await activateTheReturned(actor);

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });
});
