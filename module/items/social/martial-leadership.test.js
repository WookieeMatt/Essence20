import { jest } from '@jest/globals';
import {
  activateMartialLeadership, applyMartialLeadershipEffect, PENDING_EDGE_FLAG, PENDING_SNAG_FLAG, pickMartialLeadershipEffect,
} from './martial-leadership.mjs';

global.game = { user: { targets: { first: jest.fn() } }, i18n: { localize: jest.fn((key) => key) }, combat: null };

function makeActor() {
  return { _dice: { rollSkill: jest.fn() } };
}

function makeTargetActor() {
  const flagStore = {};
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("pickMartialLeadershipEffect", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
  });

  test("returns the chosen effect on confirm", async () => {
    waitMock.mockResolvedValue('edge');
    expect(await pickMartialLeadershipEffect()).toBe('edge');
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickMartialLeadershipEffect()).toBeNull();
  });
});

describe("activateMartialLeadership", () => {
  afterEach(() => {
    game.user.targets.first.mockReset();
  });

  test("rolls Persuasion vs Cleverness against the currently-targeted actor", async () => {
    const actor = makeActor();
    const targetActor = { uuid: 'Actor.target1' };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await activateMartialLeadership(actor);

    expect(result).toBe(targetActor);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'persuasion', defenseType: 'cleverness', isMartialLeadershipAttempt: true,
        martialLeadershipTargetUuid: 'Actor.target1',
      }),
      actor,
    );
  });

  test("returns null with no target selected", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(undefined);

    expect(await activateMartialLeadership(actor)).toBeNull();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("applyMartialLeadershipEffect", () => {
  test("banks a Snag on the target when chosen", async () => {
    const targetActor = makeTargetActor();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('snag') } } } };

    const result = await applyMartialLeadershipEffect(targetActor);

    expect(result).toBe('snag');
    expect(targetActor.setFlag).toHaveBeenCalledWith('essence20', PENDING_SNAG_FLAG, expect.anything());
  });

  test("banks an Edge on the target when chosen", async () => {
    const targetActor = makeTargetActor();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('edge') } } } };

    const result = await applyMartialLeadershipEffect(targetActor);

    expect(result).toBe('edge');
    expect(targetActor.setFlag).toHaveBeenCalledWith('essence20', PENDING_EDGE_FLAG, expect.anything());
  });

  test("returns null when cancelled", async () => {
    const targetActor = makeTargetActor();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };

    expect(await applyMartialLeadershipEffect(targetActor)).toBeNull();
    expect(targetActor.setFlag).not.toHaveBeenCalled();
  });
});
