import { jest } from '@jest/globals';
import {
  activateVoiceOfPrimus, activateVoiceOfPrimusAssist, applyVoiceOfPrimusEffect,
  bankVoiceOfPrimusAssistReady, clearVoiceOfPrimusAssistReady, hasVoiceOfPrimusAssistReady,
  pickVoiceOfPrimusEffect, pickVoiceOfPrimusMode, pickVoiceOfPrimusSkill,
} from './voice-of-primus.mjs';

global.game = { user: { targets: { first: jest.fn() } }, i18n: { localize: jest.fn((key) => key) } };

function makeActor() {
  return { _dice: { rollSkill: jest.fn() } };
}

function makeTargetActor() {
  return { system: { health: { value: 5 } }, update: jest.fn(), toggleStatusEffect: jest.fn() };
}

describe("pickVoiceOfPrimusSkill", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
  });

  test("returns the chosen skill on confirm", async () => {
    waitMock.mockResolvedValue('performance');
    expect(await pickVoiceOfPrimusSkill()).toBe('performance');
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickVoiceOfPrimusSkill()).toBeNull();
  });
});

describe("pickVoiceOfPrimusMode", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
  });

  test("returns the chosen mode on confirm", async () => {
    waitMock.mockResolvedValue('assist');
    expect(await pickVoiceOfPrimusMode()).toBe('assist');
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickVoiceOfPrimusMode()).toBeNull();
  });
});

describe("activateVoiceOfPrimus", () => {
  afterEach(() => {
    game.user.targets.first.mockReset();
  });

  // Two dialogs now fire in sequence (mode, then skill) - mockResolvedValueOnce per call.
  test("attack mode rolls the chosen skill vs Willpower against the currently-targeted actor", async () => {
    const actor = makeActor();
    const targetActor = { uuid: 'Actor.target1' };
    const wait = jest.fn()
      .mockResolvedValueOnce('attack')
      .mockResolvedValueOnce('intimidation');
    global.foundry = { applications: { api: { DialogV2: { wait } } } };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await activateVoiceOfPrimus(actor);

    expect(result).toBe(targetActor);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'intimidation', defenseType: 'willpower', isVoiceOfPrimusAttempt: true,
        voiceOfPrimusTargetUuid: 'Actor.target1',
      }),
      actor,
    );
  });

  test("assist mode rolls a flat DIF 12 Persuasion Skill Test", async () => {
    const actor = makeActor();
    const wait = jest.fn().mockResolvedValueOnce('assist');
    global.foundry = { applications: { api: { DialogV2: { wait } } } };

    const result = await activateVoiceOfPrimus(actor);

    expect(result).toBe(true);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'persuasion', dif: '12', isVoiceOfPrimusAssistAttempt: true }),
      actor,
    );
  });

  test("returns false and rolls nothing when the mode picker is cancelled", async () => {
    const actor = makeActor();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };

    const result = await activateVoiceOfPrimus(actor);

    expect(result).toBe(false);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("returns false and rolls nothing when the attack's own skill picker is cancelled", async () => {
    const actor = makeActor();
    const wait = jest.fn()
      .mockResolvedValueOnce('attack')
      .mockResolvedValueOnce('cancel');
    global.foundry = { applications: { api: { DialogV2: { wait } } } };

    const result = await activateVoiceOfPrimus(actor);

    expect(result).toBe(false);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("returns null with no target selected in attack mode", async () => {
    const actor = makeActor();
    const wait = jest.fn()
      .mockResolvedValueOnce('attack')
      .mockResolvedValueOnce('performance');
    global.foundry = { applications: { api: { DialogV2: { wait } } } };
    game.user.targets.first.mockReturnValue(undefined);

    const result = await activateVoiceOfPrimus(actor);

    expect(result).toBeNull();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("activateVoiceOfPrimusAssist", () => {
  test("rolls a flat DIF 12 Persuasion Skill Test", async () => {
    const actor = makeActor();

    await activateVoiceOfPrimusAssist(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'persuasion', dif: '12', isVoiceOfPrimusAssistAttempt: true }),
      actor,
    );
  });
});

describe("bankVoiceOfPrimusAssistReady / hasVoiceOfPrimusAssistReady / clearVoiceOfPrimusAssistReady", () => {
  function makeFlaggedActor() {
    const flags = {};
    return {
      getFlag: jest.fn((scope, key) => flags[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flags[key] = value;
      }),
      unsetFlag: jest.fn(async (scope, key) => {
        delete flags[key];
      }),
    };
  }

  beforeEach(() => {
    game.combat = null;
  });

  test("bank then read true, clear then read false", async () => {
    const actor = makeFlaggedActor();
    expect(hasVoiceOfPrimusAssistReady(actor)).toBe(false);

    await bankVoiceOfPrimusAssistReady(actor);
    expect(hasVoiceOfPrimusAssistReady(actor)).toBe(true);

    await clearVoiceOfPrimusAssistReady(actor);
    expect(hasVoiceOfPrimusAssistReady(actor)).toBe(false);
  });
});

describe("pickVoiceOfPrimusEffect", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
  });

  test("returns the chosen effect on confirm", async () => {
    waitMock.mockResolvedValue('frightened');
    expect(await pickVoiceOfPrimusEffect()).toBe('frightened');
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickVoiceOfPrimusEffect()).toBeNull();
  });
});

describe("applyVoiceOfPrimusEffect", () => {
  test("deals 1 Psychic damage when chosen", async () => {
    const targetActor = makeTargetActor();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('damage') } } } };

    const result = await applyVoiceOfPrimusEffect(targetActor);

    expect(result).toBe('damage');
    expect(targetActor.update).toHaveBeenCalledWith({ 'system.health.value': 4 });
    expect(targetActor.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test("applies Frightened when chosen", async () => {
    const targetActor = makeTargetActor();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('frightened') } } } };

    const result = await applyVoiceOfPrimusEffect(targetActor);

    expect(result).toBe('frightened');
    expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: true });
    expect(targetActor.update).not.toHaveBeenCalled();
  });

  test("returns null when cancelled", async () => {
    const targetActor = makeTargetActor();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };

    expect(await applyVoiceOfPrimusEffect(targetActor)).toBeNull();
    expect(targetActor.update).not.toHaveBeenCalled();
    expect(targetActor.toggleStatusEffect).not.toHaveBeenCalled();
  });
});
