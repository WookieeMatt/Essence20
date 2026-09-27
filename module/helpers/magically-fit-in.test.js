import { jest } from '@jest/globals';
import { activateMagicallyFitIn, canUseMagicallyFitIn, getMagicallyFitInBonus } from './magically-fit-in.mjs';

global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor({ mysticalPoints = 3, flagValue } = {}) {
  const rolePoints = { system: { resource: { value: mysticalPoints } }, update: jest.fn(async (data) => {
    rolePoints.system.resource.value = data['system.resource.value'];
  }) };
  const flags = { magicallyFitInBonus: flagValue };

  return {
    _getBaseRolePoints: jest.fn(() => rolePoints),
    getFlag: jest.fn((scope, key) => (scope == 'essence20' ? flags[key] : undefined)),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
  };
}

describe("canUseMagicallyFitIn", () => {
  test("true with Mystical Points available", () => {
    expect(canUseMagicallyFitIn(makeActor({ mysticalPoints: 1 }))).toBe(true);
  });

  test("false with no Mystical Points", () => {
    expect(canUseMagicallyFitIn(makeActor({ mysticalPoints: 0 }))).toBe(false);
  });
});

describe("activateMagicallyFitIn / getMagicallyFitInBonus", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("spends the chosen amount and banks it on the chosen Skill", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ skill: 'athletics', amount: 2 });
    const actor = makeActor({ mysticalPoints: 3 });

    await activateMagicallyFitIn(actor);

    expect(actor._getBaseRolePoints().update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
    expect(getMagicallyFitInBonus(actor, 'athletics')).toBe(2);
    expect(getMagicallyFitInBonus(actor, 'brawn')).toBe(0);
  });

  test("caps the spent amount at what's actually available", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ skill: 'athletics', amount: 99 });
    const actor = makeActor({ mysticalPoints: 2 });

    await activateMagicallyFitIn(actor);

    expect(actor._getBaseRolePoints().update).toHaveBeenCalledWith({ 'system.resource.value': 0 });
    expect(getMagicallyFitInBonus(actor, 'athletics')).toBe(2);
  });

  test("does nothing without Mystical Points available", async () => {
    const actor = makeActor({ mysticalPoints: 0 });

    await activateMagicallyFitIn(actor);

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("does nothing when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor({ mysticalPoints: 3 });

    await activateMagicallyFitIn(actor);

    expect(actor._getBaseRolePoints().update).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("getMagicallyFitInBonus returns 0 with nothing banked", () => {
    expect(getMagicallyFitInBonus(makeActor(), 'athletics')).toBe(0);
  });
});
