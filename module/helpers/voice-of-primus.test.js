import { jest } from '@jest/globals';
import {
  activateVoiceOfPrimus, applyVoiceOfPrimusEffect, pickVoiceOfPrimusEffect, pickVoiceOfPrimusSkill,
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

describe("activateVoiceOfPrimus", () => {
  afterEach(() => {
    game.user.targets.first.mockReset();
  });

  test("rolls the chosen skill vs Willpower against the currently-targeted actor", async () => {
    const actor = makeActor();
    const targetActor = { uuid: 'Actor.target1' };
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('intimidation') } } } };
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

  test("returns false and rolls nothing when the skill picker is cancelled", async () => {
    const actor = makeActor();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };

    const result = await activateVoiceOfPrimus(actor);

    expect(result).toBe(false);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("returns null with no target selected", async () => {
    const actor = makeActor();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('performance') } } } };
    game.user.targets.first.mockReturnValue(undefined);

    const result = await activateVoiceOfPrimus(actor);

    expect(result).toBeNull();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
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
