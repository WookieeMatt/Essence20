import { jest } from '@jest/globals';
import {
  activateWordsCanHurt, applyWordsCanHurtEffect, isImmuneToWordsCanHurt, pickWordsCanHurtEffect,
  pickWordsCanHurtOptions,
} from './words-can-hurt.mjs';

global.game = { user: { targets: { first: jest.fn() } }, i18n: { localize: jest.fn((key) => key) } };

function makeActor() {
  return { _dice: { rollSkill: jest.fn() } };
}

function makeTargetActor({ immune = false } = {}) {
  const flagStore = { wordsCanHurtImmune: immune };
  return {
    system: { health: { value: 5 } },
    update: jest.fn(),
    toggleStatusEffect: jest.fn(),
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isImmuneToWordsCanHurt", () => {
  test("false by default", () => {
    expect(isImmuneToWordsCanHurt(makeTargetActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isImmuneToWordsCanHurt(makeTargetActor({ immune: true }))).toBe(true);
  });
});

describe("pickWordsCanHurtOptions", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
  });

  test("returns the chosen skill and Defense on confirm", async () => {
    waitMock.mockResolvedValue({ skill: 'persuasion', defenseType: 'cleverness' });
    expect(await pickWordsCanHurtOptions()).toEqual({ skill: 'persuasion', defenseType: 'cleverness' });
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickWordsCanHurtOptions()).toBeNull();
  });
});

describe("activateWordsCanHurt", () => {
  afterEach(() => {
    game.user.targets.first.mockReset();
  });

  test("rolls the chosen skill vs the chosen Defense against the currently-targeted actor", async () => {
    const actor = makeActor();
    const targetActor = { ...makeTargetActor(), uuid: 'Actor.target1' };
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue({ skill: 'performance', defenseType: 'willpower' }) } } },
    };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await activateWordsCanHurt(actor);

    expect(result).toBe(targetActor);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'performance', defenseType: 'willpower', isWordsCanHurtAttempt: true,
        wordsCanHurtTargetUuid: 'Actor.target1',
      }),
      actor,
    );
  });

  test("returns 'immune' and rolls nothing against an already-immune target", async () => {
    const actor = makeActor();
    const targetActor = { ...makeTargetActor({ immune: true }), uuid: 'Actor.target1' };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await activateWordsCanHurt(actor);

    expect(result).toBe('immune');
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("returns false and rolls nothing when the options picker is cancelled", async () => {
    const actor = makeActor();
    const targetActor = { ...makeTargetActor(), uuid: 'Actor.target1' };
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await activateWordsCanHurt(actor);

    expect(result).toBe(false);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("returns null with no target selected", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(undefined);

    const result = await activateWordsCanHurt(actor);

    expect(result).toBeNull();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("pickWordsCanHurtEffect", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
  });

  test("returns the chosen effect on confirm", async () => {
    waitMock.mockResolvedValue('frightened');
    expect(await pickWordsCanHurtEffect()).toBe('frightened');
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickWordsCanHurtEffect()).toBeNull();
  });
});

describe("applyWordsCanHurtEffect", () => {
  test("marks the target immune and deals 1 Psychic damage when chosen", async () => {
    const targetActor = makeTargetActor();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('damage') } } } };

    const result = await applyWordsCanHurtEffect(targetActor);

    expect(result).toBe('damage');
    expect(targetActor.setFlag).toHaveBeenCalledWith('essence20', 'wordsCanHurtImmune', true);
    expect(targetActor.update).toHaveBeenCalledWith({ 'system.health.value': 4 });
    expect(targetActor.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test("marks the target immune and applies Frightened when chosen", async () => {
    const targetActor = makeTargetActor();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('frightened') } } } };

    const result = await applyWordsCanHurtEffect(targetActor);

    expect(result).toBe('frightened');
    expect(targetActor.setFlag).toHaveBeenCalledWith('essence20', 'wordsCanHurtImmune', true);
    expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: true });
    expect(targetActor.update).not.toHaveBeenCalled();
  });

  test("still marks the target immune even when the effect picker is cancelled", async () => {
    const targetActor = makeTargetActor();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };

    expect(await applyWordsCanHurtEffect(targetActor)).toBeNull();
    expect(targetActor.setFlag).toHaveBeenCalledWith('essence20', 'wordsCanHurtImmune', true);
    expect(targetActor.update).not.toHaveBeenCalled();
    expect(targetActor.toggleStatusEffect).not.toHaveBeenCalled();
  });
});
