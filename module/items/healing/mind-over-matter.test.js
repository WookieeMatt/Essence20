import { jest } from '@jest/globals';
import { activateMindOverMatter, applyMindOverMatterHeal } from './mind-over-matter.mjs';

global.game = { i18n: { localize: (k) => k }, user: { targets: { first: jest.fn(() => undefined) } } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
global.ui = { notifications: { warn: jest.fn() } };

function makeActor() {
  return { _dice: { rollSkill: jest.fn() } };
}

describe("activateMindOverMatter", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
    ui.notifications.warn.mockReset();
    game.user.targets.first.mockReturnValue({ actor: { id: 'ally1' } });
  });

  test("warns and does nothing with no target selected", async () => {
    game.user.targets.first.mockReturnValue(undefined);
    const actor = makeActor();

    await activateMindOverMatter(actor);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("rolls the chosen skill (Intimidation) with its own correct Essence and DIF", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ skill: 'intimidation', amount: 2 });
    const actor = makeActor();

    await activateMindOverMatter(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'intimidation', essence: 'strength', dif: '15', isMindOverMatter: true, mindOverMatterAmount: 2,
      }),
      actor,
    );
  });

  test("rolls the chosen skill (Persuasion) with its own correct Essence", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ skill: 'persuasion', amount: 1 });
    const actor = makeActor();

    await activateMindOverMatter(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'persuasion', essence: 'social', dif: '10' }),
      actor,
    );
  });

  test("does nothing when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();

    await activateMindOverMatter(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("applyMindOverMatterHeal", () => {
  function makeTarget({ health = 3, max = 10, defeated = false } = {}) {
    return {
      system: { health: { value: health, max } },
      statuses: new Set(defeated ? ['defeated'] : []),
      update: jest.fn(),
      toggleStatusEffect: jest.fn(),
    };
  }

  test("heals the chosen amount with no bonus", async () => {
    const target = makeTarget({ health: 3, defeated: false });

    await applyMindOverMatterHeal(target, 2);

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    expect(target.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test("clears Defeated on a successful heal, no +1 bonus", async () => {
    const target = makeTarget({ health: 0, defeated: true });

    await applyMindOverMatterHeal(target, 2);

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 2 });
    expect(target.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: false });
  });

  test("caps healing at max Health", async () => {
    const target = makeTarget({ health: 9, max: 10, defeated: false });

    await applyMindOverMatterHeal(target, 5);

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });
});
