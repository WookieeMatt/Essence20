import { jest } from '@jest/globals';
import { getAnimalGaitType, pickAnimalGaitType, toggleAnimalGait } from './animal-gait.mjs';

global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor({ flag = null } = {}) {
  return {
    getFlag: jest.fn(() => flag),
    setFlag: jest.fn(),
    unsetFlag: jest.fn(),
  };
}

beforeEach(() => {
  foundry.applications.api.DialogV2.wait.mockReset();
});

describe("getAnimalGaitType", () => {
  test("null when inactive", () => {
    expect(getAnimalGaitType(makeActor())).toBeNull();
  });

  test("returns the active movement type", () => {
    expect(getAnimalGaitType(makeActor({ flag: 'climb' }))).toBe('climb');
  });
});

describe("pickAnimalGaitType", () => {
  test("returns the chosen type", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('aerial');
    expect(await pickAnimalGaitType()).toBe('aerial');
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickAnimalGaitType()).toBeNull();
  });
});

describe("toggleAnimalGait", () => {
  test("switching ON prompts and sets the chosen type", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('swim');
    const actor = makeActor();

    const nowActive = await toggleAnimalGait(actor);

    expect(nowActive).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'animalGaitMovementType', 'swim');
  });

  test("returns null and sets nothing when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();

    expect(await toggleAnimalGait(actor)).toBeNull();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("switching OFF clears the flag", async () => {
    const actor = makeActor({ flag: 'aerial' });

    const nowActive = await toggleAnimalGait(actor);

    expect(nowActive).toBe(false);
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'animalGaitMovementType');
  });
});
