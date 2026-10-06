import { jest } from '@jest/globals';
import { getFastLearnerAllocation, pickFastLearnerAllocation } from './fast-learner.mjs';

global.game = {
  i18n: { localize: (key) => key, format: (key) => key },
};

function makeActor({ shift = 'd8', allocation } = {}) {
  return {
    getFlag: jest.fn((scope, key) => (scope == 'essence20' && key == 'fastLearnerAllocation' ? allocation : undefined)),
    setFlag: jest.fn(),
    getRollData: jest.fn(() => ({
      skills: {
        science: { shift },
        technology: { shift: 'd2' },
      },
    })),
  };
}

describe("getFastLearnerAllocation", () => {
  test("returns the stored allocation", () => {
    const actor = makeActor({ allocation: { decreaseSkill: 'science', increaseSkill: 'technology' } });
    expect(getFastLearnerAllocation(actor)).toEqual({ decreaseSkill: 'science', increaseSkill: 'technology' });
  });

  test("returns null with no stored allocation", () => {
    const actor = makeActor();
    expect(getFastLearnerAllocation(actor)).toBeNull();
  });
});

describe("pickFastLearnerAllocation", () => {
  test("stores the chosen pair and returns true", async () => {
    const actor = makeActor();
    global.foundry = {
      applications: {
        api: {
          DialogV2: {
            wait: jest.fn(async ({ buttons }) => buttons[0].callback(null, {
              form: { elements: { decreaseSkill: { value: 'science' }, increaseSkill: { value: 'technology' } } },
            })),
          },
        },
      },
    };

    const result = await pickFastLearnerAllocation(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'fastLearnerAllocation', {
      decreaseSkill: 'science', increaseSkill: 'technology',
    });
  });

  test("cancelling the picker sets nothing", async () => {
    const actor = makeActor();
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn(async () => 'cancel') } } },
    };

    const result = await pickFastLearnerAllocation(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("picking the same Skill for both sets nothing", async () => {
    const actor = makeActor();
    global.foundry = {
      applications: {
        api: {
          DialogV2: {
            wait: jest.fn(async ({ buttons }) => buttons[0].callback(null, {
              form: { elements: { decreaseSkill: { value: 'science' }, increaseSkill: { value: 'science' } } },
            })),
          },
        },
      },
    };

    const result = await pickFastLearnerAllocation(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
