import { jest } from '@jest/globals';
import { activateRegeneration, activateRegenerationChoice, applyRegenerationHeal } from './regeneration.mjs';

global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor({ health = 5, max = 10 } = {}) {
  return {
    system: { health: { value: health, max } },
    update: jest.fn(),
    _dice: { rollSkill: jest.fn() },
  };
}

describe("activateRegeneration", () => {
  test("heals 1 Health", async () => {
    const actor = makeActor({ health: 5, max: 10 });
    await activateRegeneration(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 6 });
  });

  test("doesn't heal past max Health", async () => {
    const actor = makeActor({ health: 10, max: 10 });
    await activateRegeneration(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });
});

describe("activateRegenerationChoice", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("applies the automatic heal when that mode is chosen", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('automatic');
    const actor = makeActor({ health: 5 });

    const activated = await activateRegenerationChoice(actor);

    expect(activated).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 6 });
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("rolls Science with a forced Edge flag and the chosen amount when the Skill Test mode is chosen", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('skillTest').mockResolvedValueOnce(3);
    const actor = makeActor();

    const activated = await activateRegenerationChoice(actor);

    expect(activated).toBe(true);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'science', essence: 'smarts', dif: '20', isRegeneration: true, regenerationAmount: 3,
      }),
      actor,
    );
  });

  test("returns false when the mode picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();

    const activated = await activateRegenerationChoice(actor);

    expect(activated).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("returns false when the amount picker is cancelled after choosing Skill Test mode", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('skillTest').mockResolvedValueOnce('cancel');
    const actor = makeActor();

    const activated = await activateRegenerationChoice(actor);

    expect(activated).toBe(false);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("applyRegenerationHeal", () => {
  function makeTarget({ health = 3, max = 10, defeated = false } = {}) {
    return {
      system: { health: { value: health, max } },
      statuses: new Set(defeated ? ['defeated'] : []),
      update: jest.fn(),
      toggleStatusEffect: jest.fn(),
    };
  }

  test("heals the chosen amount, no bonus", async () => {
    const target = makeTarget({ health: 3 });
    await applyRegenerationHeal(target, 2);
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
  });

  test("clears Defeated on a successful heal", async () => {
    const target = makeTarget({ health: 0, defeated: true });
    await applyRegenerationHeal(target, 2);
    expect(target.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: false });
  });

  test("caps healing at max Health", async () => {
    const target = makeTarget({ health: 9, max: 10 });
    await applyRegenerationHeal(target, 5);
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });
});
