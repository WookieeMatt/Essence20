import { jest } from '@jest/globals';
import { getTimeTravelerActiveSkill, toggleTimeTravelerSnagImmunity } from './time-traveler.mjs';

global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
global.game = {
  i18n: { localize: (key) => key },
  socket: { emit: jest.fn() },
};

function makeActor({ activeSkill = null } = {}) {
  const flagStore = { timeTravelerSnagImmuneSkill: activeSkill };
  return {
    name: 'Time Traveler',
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flagStore[key];
    }),
  };
}

beforeEach(() => {
  foundry.applications.api.DialogV2.wait.mockReset();
  game.socket.emit.mockClear();
});

describe("getTimeTravelerActiveSkill", () => {
  test("null by default", () => {
    expect(getTimeTravelerActiveSkill(makeActor())).toBeNull();
  });

  test("returns the banked skill once active", () => {
    expect(getTimeTravelerActiveSkill(makeActor({ activeSkill: 'technology' }))).toBe('technology');
  });
});

describe("toggleTimeTravelerSnagImmunity", () => {
  test("prompts for a skill, spends 1 Story Point, and activates on confirm", async () => {
    const actor = makeActor();
    foundry.applications.api.DialogV2.wait.mockResolvedValue('technology');

    const result = await toggleTimeTravelerSnagImmunity(actor);

    expect(result).toBe('technology');
    expect(game.socket.emit).toHaveBeenCalledWith("system.essence20", expect.objectContaining({
      action: 'spendStoryPoints', amount: 1,
    }));
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'timeTravelerSnagImmuneSkill', 'technology');
  });

  test("spends nothing and stays off if the picker is cancelled", async () => {
    const actor = makeActor();
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');

    const result = await toggleTimeTravelerSnagImmunity(actor);

    expect(result).toBeNull();
    expect(game.socket.emit).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("deactivates for free when already active, without opening the picker", async () => {
    const actor = makeActor({ activeSkill: 'technology' });

    const result = await toggleTimeTravelerSnagImmunity(actor);

    expect(result).toBeNull();
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(game.socket.emit).not.toHaveBeenCalled();
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'timeTravelerSnagImmuneSkill');
  });
});
