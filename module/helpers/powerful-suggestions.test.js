import { jest } from '@jest/globals';
import {
  activatePowerfulSuggestions, pickPowerfulSuggestionOptions, POWERFUL_SUGGESTION_FLAG,
} from './powerful-suggestions.mjs';

global.game = {
  user: { targets: { first: jest.fn() } },
  i18n: { localize: jest.fn((key) => key) },
  combat: null,
};

function makeActor() {
  return { _dice: { rollSkill: jest.fn() } };
}

function makeTargetActor() {
  return { getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
}

describe("pickPowerfulSuggestionOptions", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
  });

  test("returns the chosen skill and effect on confirm", async () => {
    waitMock.mockResolvedValue({ skill: 'athletics', effect: 'excel' });
    expect(await pickPowerfulSuggestionOptions()).toEqual({ skill: 'athletics', effect: 'excel' });
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickPowerfulSuggestionOptions()).toBeNull();
  });
});

describe("activatePowerfulSuggestions", () => {
  afterEach(() => {
    game.user.targets.first.mockReset();
  });

  test("banks the chosen skill/effect on the currently-targeted actor", async () => {
    const actor = makeActor();
    const targetActor = makeTargetActor();
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue({ skill: 'athletics', effect: 'fail' }) } } },
    };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await activatePowerfulSuggestions(actor);

    expect(result).toBe(targetActor);
    expect(targetActor.setFlag).toHaveBeenCalledWith(
      'essence20', POWERFUL_SUGGESTION_FLAG, expect.objectContaining({ skill: 'athletics', effect: 'fail' }),
    );
  });

  test("returns false and banks nothing when the options picker is cancelled", async () => {
    const actor = makeActor();
    const targetActor = makeTargetActor();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await activatePowerfulSuggestions(actor);

    expect(result).toBe(false);
    expect(targetActor.setFlag).not.toHaveBeenCalled();
  });

  test("returns null with no target selected", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(undefined);

    const result = await activatePowerfulSuggestions(actor);

    expect(result).toBeNull();
  });
});
