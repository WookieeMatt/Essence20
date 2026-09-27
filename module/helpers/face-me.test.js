import { jest } from '@jest/globals';
import { activateFaceMe, applyFaceMeEffect } from './face-me.mjs';

global.game = { i18n: { localize: (k) => k }, user: { targets: { first: jest.fn(() => undefined) } } };
global.ui = { notifications: { warn: jest.fn() } };

function makeActor(id = 'actor1') {
  return { id, _dice: { rollSkill: jest.fn() } };
}

function makeTarget() {
  return { setFlag: jest.fn(), getFlag: jest.fn() };
}

describe("activateFaceMe", () => {
  beforeEach(() => {
    ui.notifications.warn.mockReset();
    game.user.targets.first.mockReset();
  });

  test("warns and does nothing with no target selected", async () => {
    game.user.targets.first.mockReturnValue(undefined);
    const actor = makeActor();

    await activateFaceMe(actor);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("rolls Intimidation vs Willpower against the targeted token", async () => {
    game.user.targets.first.mockReturnValue({ actor: { id: 'target1' } });
    const actor = makeActor();

    await activateFaceMe(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'intimidation', essence: 'strength', defenseType: 'willpower', isFaceMe: true }),
      actor,
    );
  });
});

describe("applyFaceMeEffect", () => {
  test("banks the holder's own id on the target", async () => {
    const holder = makeActor('holder1');
    const target = makeTarget();

    await applyFaceMeEffect(holder, target);

    expect(target.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingFaceMeCompeller', expect.objectContaining({ holderId: 'holder1' }),
    );
  });
});
