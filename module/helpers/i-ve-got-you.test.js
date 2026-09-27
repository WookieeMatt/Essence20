import { jest } from '@jest/globals';
import { activateIveGotYou, applyIveGotYouHeal, UP_AND_AT_EM_ID } from './i-ve-got-you.mjs';

global.game = { i18n: { localize: (k) => k }, user: { targets: { first: jest.fn(() => undefined) } } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
global.ui = { notifications: { warn: jest.fn() } };

function makeActor({ perkIds = [] } = {}) {
  return {
    _dice: { rollSkill: jest.fn() },
    items: perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } })),
  };
}

describe("activateIveGotYou", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
    ui.notifications.warn.mockReset();
    game.user.targets.first.mockReturnValue({ actor: { id: 'ally1' } });
  });

  test("warns and does nothing with no target selected", async () => {
    game.user.targets.first.mockReturnValue(undefined);
    const actor = makeActor();

    await activateIveGotYou(actor);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("computes DIF from RAW's own formula (5 + 5 per Health) and rolls Science", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(2);
    const actor = makeActor();

    await activateIveGotYou(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'science', essence: 'smarts', dif: '15', isIveGotYou: true, iveGotYouAmount: 2,
      }),
      actor,
    );
  });

  test("does nothing when the amount picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();

    await activateIveGotYou(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("applyIveGotYouHeal", () => {
  function makeTarget({ health = 3, max = 10, defeated = false } = {}) {
    return {
      system: { health: { value: health, max } },
      statuses: new Set(defeated ? ['defeated'] : []),
      update: jest.fn(),
      toggleStatusEffect: jest.fn(),
      setFlag: jest.fn(),
    };
  }

  test("heals the chosen amount for a non-Defeated target, no bonus", async () => {
    const target = makeTarget({ health: 3, defeated: false });

    await applyIveGotYouHeal(target, 2, makeActor());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    expect(target.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test("heals the chosen amount plus 1, and clears Defeated, for a Defeated target", async () => {
    const target = makeTarget({ health: 0, defeated: true });

    await applyIveGotYouHeal(target, 2, makeActor());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 3 }); // 0 + 2 + 1
    expect(target.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: false });
  });

  test("caps healing at max Health", async () => {
    const target = makeTarget({ health: 9, max: 10, defeated: false });

    await applyIveGotYouHeal(target, 5, makeActor());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });

  test("Up And At 'Em: adds a further +1 and banks an Edge, only for a Defeated target", async () => {
    const target = makeTarget({ health: 0, defeated: true });
    const medic = makeActor({ perkIds: [UP_AND_AT_EM_ID] });

    await applyIveGotYouHeal(target, 2, medic);

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 4 }); // 0 + 2 + 1 (I've Got You) + 1 (Up And At 'Em)
    expect(target.setFlag).toHaveBeenCalledWith('essence20', 'pendingUpAndAtEmEdge', expect.objectContaining({ edge: true }));
  });

  test("Up And At 'Em doesn't apply to a non-Defeated target, even if the medic holds it", async () => {
    const target = makeTarget({ health: 5, defeated: false });
    const medic = makeActor({ perkIds: [UP_AND_AT_EM_ID] });

    await applyIveGotYouHeal(target, 2, medic);

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 7 }); // just the chosen amount
    expect(target.setFlag).not.toHaveBeenCalled();
  });
});
