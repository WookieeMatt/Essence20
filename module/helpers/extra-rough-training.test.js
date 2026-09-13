import { jest } from '@jest/globals';
import { canTrainAlly, activateExtraRoughTraining } from './extra-rough-training.mjs';

global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
global.game = { user: { targets: { first: jest.fn() } }, combat: null, i18n: { localize: (key) => key } };

function makeAlly({ usedFlag = undefined } = {}) {
  const flagStore = { extraRoughTrainingUsedThisMission: usedFlag };
  return {
    _dice: { rollSkill: jest.fn() },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value; 
    }),
  };
}

describe("canTrainAlly", () => {
  test("true by default, false once already used this mission", () => {
    expect(canTrainAlly(makeAlly())).toBe(true);
    expect(canTrainAlly(makeAlly({ usedFlag: true }))).toBe(false);
  });
});

describe("activateExtraRoughTraining", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
    game.user.targets.first.mockReset();
  });

  test("triggers the ally's own DIF 15 Skill Test for the chosen skill, and marks them used", async () => {
    const ally = makeAlly();
    game.user.targets.first.mockReturnValue({ actor: ally });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('might');

    const result = await activateExtraRoughTraining({});

    expect(result).toBe(true);
    expect(ally._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'might', essence: 'strength', dif: '15',
        isExtraRoughTrainingAttempt: true, extraRoughTrainingSkill: 'might',
      }),
      ally,
    );
    expect(ally.setFlag).toHaveBeenCalledWith('essence20', 'extraRoughTrainingUsedThisMission', true);
  });

  test("returns false and doesn't roll when the skill picker is cancelled", async () => {
    const ally = makeAlly();
    game.user.targets.first.mockReturnValue({ actor: ally });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');

    const result = await activateExtraRoughTraining({});

    expect(result).toBe(false);
    expect(ally._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("returns null with no valid target, or a target who's already used their attempt this mission", async () => {
    game.user.targets.first.mockReturnValue(undefined);
    expect(await activateExtraRoughTraining({})).toBeNull();

    const usedAlly = makeAlly({ usedFlag: true });
    game.user.targets.first.mockReturnValue({ actor: usedAlly });
    expect(await activateExtraRoughTraining({})).toBeNull();
    expect(usedAlly._dice.rollSkill).not.toHaveBeenCalled();
  });
});
