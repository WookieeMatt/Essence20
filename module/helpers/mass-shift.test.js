import { jest } from '@jest/globals';
import {
  activateMassShift, canUseMassShift, isMassShiftReachActive,
  MASS_SHIFT_DEFENSE_FLAG, MASS_SHIFT_SKILL_FLAG,
} from './mass-shift.mjs';

global.game = { i18n: { localize: (k) => k } };

function makeActor(flagStore = {}, { health = { value: 5, max: 10, bonus: 0 } } = {}) {
  return {
    system: { health },
    getFlag: jest.fn((scope, key) => (scope == 'essence20' ? flagStore[key] : undefined)),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    update: jest.fn(async (data) => Object.assign({}, data)),
  };
}

describe("canUseMassShift", () => {
  test("true before it's used, false once already used this scene", () => {
    global.game.combat = { id: 'combat1' };
    expect(canUseMassShift(makeActor())).toBe(true);

    const actor = makeActor({ massShiftUsedThisScene: { epoch: 1, window: 'encounter', count: 1 } });
    expect(canUseMassShift(actor)).toBe(false);
  });
});

describe("activateMassShift", () => {
  let originalFoundry;
  beforeEach(() => {
    global.game.combat = { id: 'combat1', round: 1 };
    originalFoundry = global.foundry;
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
  });
  afterEach(() => {
    global.foundry = originalFoundry;
  });

  test("banks a +1 Defense bonus", async () => {
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue({ benefit: 'defense', defenseType: 'toughness', skill: 'athletics' });
    const actor = makeActor();

    const activated = await activateMassShift(actor);

    expect(activated).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', MASS_SHIFT_DEFENSE_FLAG, expect.objectContaining({ defenseAmounts: { toughness: 1 } }),
    );
  });

  test("banks a scoped Skill upshift", async () => {
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue({ benefit: 'skill', defenseType: 'toughness', skill: 'athletics' });
    const actor = makeActor();

    await activateMassShift(actor);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', MASS_SHIFT_SKILL_FLAG, expect.objectContaining({ skill: 'athletics', shiftUp: 1 }),
    );
  });

  test("toggles the Reach flag on", async () => {
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue({ benefit: 'reach', defenseType: 'toughness', skill: 'athletics' });
    const actor = makeActor();

    await activateMassShift(actor);

    expect(isMassShiftReachActive(actor)).toBe(true);
  });

  test("grants 1 Temporary Health", async () => {
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue({ benefit: 'temphealth', defenseType: 'toughness', skill: 'athletics' });
    const actor = makeActor();

    await activateMassShift(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 1 });
  });

  test("does nothing when the picker is cancelled", async () => {
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();

    const activated = await activateMassShift(actor);

    expect(activated).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("does nothing once already used this scene", async () => {
    const actor = makeActor({ massShiftUsedThisScene: { epoch: 1, window: 'encounter', count: 1 } });

    const activated = await activateMassShift(actor);

    expect(activated).toBe(false);
    expect(global.foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });
});
