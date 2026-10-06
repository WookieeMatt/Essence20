import { jest } from '@jest/globals';
import {
  activateCalmingWords, applyCalmingWordsEffect, isCalmingWordsBuffActive, pickCalmingWordsOptions,
} from './calming-words.mjs';

global.game = { user: { targets: { first: jest.fn() } }, i18n: { localize: jest.fn((key) => key) } };

function makeActor({ energon = 1 } = {}) {
  return {
    _dice: { rollSkill: jest.fn() },
    system: { energon: { normal: { value: energon } } },
    update: jest.fn(),
  };
}

function makeTargetActor({ buffActive = false } = {}) {
  const flagStore = { calmingWordsBuffActive: buffActive };
  return {
    system: { resistances: {} },
    update: jest.fn(),
    toggleStatusEffect: jest.fn(),
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isCalmingWordsBuffActive", () => {
  test("false by default", () => {
    expect(isCalmingWordsBuffActive(makeTargetActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isCalmingWordsBuffActive(makeTargetActor({ buffActive: true }))).toBe(true);
  });
});

describe("pickCalmingWordsOptions", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
  });

  test("returns the chosen action and Defense on confirm", async () => {
    waitMock.mockResolvedValue({ action: 'cure', defenseType: 'willpower' });
    expect(await pickCalmingWordsOptions()).toEqual({ action: 'cure', defenseType: 'willpower' });
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickCalmingWordsOptions()).toBeNull();
  });
});

describe("activateCalmingWords", () => {
  afterEach(() => {
    game.user.targets.first.mockReset();
  });

  test("rolls Persuasion vs. the chosen Defense against the currently-targeted actor (soothe)", async () => {
    const actor = makeActor();
    const targetActor = { uuid: 'Actor.target1' };
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue({ action: 'soothe', defenseType: 'willpower' }) } } },
    };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await activateCalmingWords(actor);

    expect(result).toBe(targetActor);
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'persuasion', defenseType: 'willpower', isCalmingWordsAttempt: true,
        calmingWordsTargetUuid: 'Actor.target1', calmingWordsAction: 'soothe',
      }),
      actor,
    );
  });

  test("spends 1 Energon and rolls for a cure attempt when affordable", async () => {
    const actor = makeActor({ energon: 2 });
    const targetActor = { uuid: 'Actor.target1' };
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue({ action: 'cure', defenseType: 'cleverness' }) } } },
    };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await activateCalmingWords(actor);

    expect(result).toBe(targetActor);
    expect(actor.update).toHaveBeenCalledWith({ 'system.energon.normal.value': 1 });
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ calmingWordsAction: 'cure', defenseType: 'cleverness' }),
      actor,
    );
  });

  test("returns 'noEnergon' and rolls nothing for a cure attempt without Energon", async () => {
    const actor = makeActor({ energon: 0 });
    const targetActor = { uuid: 'Actor.target1' };
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue({ action: 'cure', defenseType: 'willpower' }) } } },
    };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await activateCalmingWords(actor);

    expect(result).toBe('noEnergon');
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("returns false and rolls nothing when the options picker is cancelled", async () => {
    const actor = makeActor();
    const targetActor = { uuid: 'Actor.target1' };
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await activateCalmingWords(actor);

    expect(result).toBe(false);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("returns null with no target selected", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(undefined);

    const result = await activateCalmingWords(actor);

    expect(result).toBeNull();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("applyCalmingWordsEffect", () => {
  test("soothe: sets the buff flag and grants Psychic Resistance", async () => {
    const targetActor = makeTargetActor();

    await applyCalmingWordsEffect(targetActor, 'soothe');

    expect(targetActor.setFlag).toHaveBeenCalledWith('essence20', 'calmingWordsBuffActive', true);
    expect(targetActor.update).toHaveBeenCalledWith({ 'system.resistances.psychic': true });
    expect(targetActor.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test("cure: removes Frightened and Mesmerized, no buff flag", async () => {
    const targetActor = makeTargetActor();

    await applyCalmingWordsEffect(targetActor, 'cure');

    expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
    expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('mesmerized', { active: false });
    expect(targetActor.setFlag).not.toHaveBeenCalled();
    expect(targetActor.update).not.toHaveBeenCalled();
  });
});
