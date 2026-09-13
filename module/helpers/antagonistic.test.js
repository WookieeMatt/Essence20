import { jest } from '@jest/globals';
import { activateAntagonistic, applyAntagonisticEffect, pickAntagonisticEffect } from './antagonistic.mjs';

global.game = { i18n: { localize: (k) => k }, user: { targets: { first: jest.fn() } } };
global.ui = { notifications: { warn: jest.fn() } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor(id = 'actor1') {
  return { id, setFlag: jest.fn(), _dice: { rollSkill: jest.fn() } };
}

beforeEach(() => {
  ui.notifications.warn.mockReset();
  game.user.targets.first.mockReset();
  foundry.applications.api.DialogV2.wait.mockReset();
});

describe("pickAntagonisticEffect", () => {
  test("returns the chosen effect", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('snag');
    expect(await pickAntagonisticEffect()).toBe('snag');
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickAntagonisticEffect()).toBeNull();
  });
});

describe("applyAntagonisticEffect", () => {
  test("banks a shiftDown on the target", async () => {
    const actor = makeActor('actor1');
    const target = makeActor('target1');

    await applyAntagonisticEffect(actor, target, 'shiftDown');

    expect(target.setFlag).toHaveBeenCalledWith('essence20', 'pendingAntagonisticShiftDown',
      expect.objectContaining({ shiftDown: 1 }));
  });

  test("banks a beneficiary-scoped Snag on the target", async () => {
    const actor = makeActor('actor1');
    const target = makeActor('target1');

    await applyAntagonisticEffect(actor, target, 'snag');

    expect(target.setFlag).toHaveBeenCalledWith('essence20', 'pendingAntagonisticSnag',
      expect.objectContaining({ beneficiaryId: 'actor1' }));
  });
});

describe("activateAntagonistic", () => {
  test("warns and does not roll with no target", async () => {
    game.user.targets.first.mockReturnValue(undefined);
    const actor = makeActor();

    await activateAntagonistic(actor);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("rolls Intimidation against Cleverness", async () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('target1') });
    const actor = makeActor();

    await activateAntagonistic(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'intimidation', essence: 'strength', defenseType: 'cleverness', isAntagonistic: true }),
      actor,
    );
  });
});
