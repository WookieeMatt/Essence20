import { jest } from '@jest/globals';
import { activateToughItOut, canUseToughItOut } from './tough-it-out.mjs';
import { markUsedThisEncounter } from './perks.mjs';

global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
global.ui = { notifications: { warn: jest.fn() } };

function setEpochs({ encounter = 1 } = {}) {
  global.game.settings = {
    get: (scope, key) => (key === "sceneClockEncounter" ? encounter : undefined),
  };
}

function makeActor(flags = {}) {
  const store = { ...flags };
  return {
    getFlag: jest.fn((scope, key) => store[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      store[key] = value; 
    }),
    update: jest.fn(),
    _dice: { rollSkill: jest.fn() },
  };
}

beforeEach(() => {
  global.game = { combat: { id: "combat1", round: 1, turn: 0 }, i18n: { localize: (k) => k } };
  setEpochs();
  foundry.applications.api.DialogV2.wait.mockReset();
  ui.notifications.warn.mockReset();
});

describe("canUseToughItOut", () => {
  test("true with no prior use this encounter", () => {
    expect(canUseToughItOut(makeActor())).toBe(true);
  });

  test("false once already used this encounter", async () => {
    const actor = makeActor();
    await markUsedThisEncounter(actor, 'toughItOutUsedThisEncounter');
    expect(canUseToughItOut(actor)).toBe(false);
  });
});

describe("activateToughItOut", () => {
  test("warns and does not roll when unavailable", async () => {
    const actor = makeActor();
    await markUsedThisEncounter(actor, 'toughItOutUsedThisEncounter');

    await activateToughItOut(actor);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("marks the encounter used and rolls Brawn at RAW's own DIF, self-targeted", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce(3);
    const actor = makeActor();

    await activateToughItOut(actor);

    expect(canUseToughItOut(actor)).toBe(false);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'brawn', essence: 'strength', dif: '20', isToughItOut: true, toughItOutAmount: 3,
      }),
      actor,
    );
  });

  test("does nothing when the amount picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('cancel');
    const actor = makeActor();

    await activateToughItOut(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    expect(canUseToughItOut(actor)).toBe(true);
  });
});
