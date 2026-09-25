import { jest } from '@jest/globals';
import { applyHealSkillTestResult, computeRestoreHealthDif, pickHealSkillTestAmount } from './heal-skill-test.mjs';

global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

describe("computeRestoreHealthDif", () => {
  test("RAW's own formula: 5 + 5 per Health", () => {
    expect(computeRestoreHealthDif(1)).toBe(10);
    expect(computeRestoreHealthDif(4)).toBe(25);
  });
});

describe("pickHealSkillTestAmount", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("returns the chosen amount, capped at maxAmount", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(9);
    expect(await pickHealSkillTestAmount(6)).toBe(6);
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickHealSkillTestAmount(6)).toBeNull();
  });
});

describe("applyHealSkillTestResult", () => {
  function makeTarget({ health = 3, max = 10, bonus = 0, defeated = false } = {}) {
    return {
      system: { health: { value: health, max, bonus } },
      statuses: new Set(defeated ? ['defeated'] : []),
      update: jest.fn(),
      toggleStatusEffect: jest.fn(),
    };
  }

  test("heals real Health, capped at max, and clears Defeated", async () => {
    const target = makeTarget({ health: 9, max: 10, defeated: true });

    await applyHealSkillTestResult(target, 5);

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
    expect(target.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: false });
  });

  test("grants Temp Health instead when isTempHealth is set, no Defeated clear", async () => {
    const target = makeTarget({ bonus: 1, defeated: true });

    await applyHealSkillTestResult(target, 3, { isTempHealth: true });

    expect(target.update).toHaveBeenCalledWith({ 'system.health.bonus': 4 });
    expect(target.toggleStatusEffect).not.toHaveBeenCalled();
  });
});
