import { jest } from '@jest/globals';
import { activateSiphon, applySiphonEffect, pickSiphonDefenseType } from './siphon.mjs';

global.game = {
  i18n: { localize: (key) => key },
  user: { targets: { first: jest.fn(() => undefined) } },
};
global.ui = { notifications: { warn: jest.fn() } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor() {
  return { _dice: { rollSkill: jest.fn() } };
}

beforeEach(() => {
  ui.notifications.warn.mockClear();
  foundry.applications.api.DialogV2.wait.mockReset();
  game.user.targets.first.mockReturnValue(undefined);
});

describe("pickSiphonDefenseType", () => {
  test("returns the chosen Defense", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('evasion');
    expect(await pickSiphonDefenseType()).toBe('evasion');
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickSiphonDefenseType()).toBeNull();
  });
});

describe("activateSiphon", () => {
  test("triggers a Technology roll against the chosen Defense", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue({ actor: {} });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('toughness');

    await activateSiphon(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'technology', defenseType: 'toughness', isSiphon: true }), actor,
    );
  });

  test("warns and does nothing without a target", async () => {
    const actor = makeActor();

    await activateSiphon(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("does nothing when the picker is cancelled", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue({ actor: {} });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');

    await activateSiphon(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("applySiphonEffect", () => {
  test("deals 1 Damage and grants 1 Energon, floored/uncapped respectively", async () => {
    const target = { system: { health: { value: 0 } }, update: jest.fn() };
    const actor = { system: { energon: { normal: { value: 2 } } }, update: jest.fn() };

    await applySiphonEffect(target, actor);

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
    expect(actor.update).toHaveBeenCalledWith({ 'system.energon.normal.value': 3 });
  });
});
