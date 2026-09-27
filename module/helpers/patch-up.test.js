import { jest } from '@jest/globals';
import { activatePatchUp, canUsePatchUp } from './patch-up.mjs';

global.game = {
  combat: { id: 'combat1', round: 1, turn: 0 },
  i18n: { localize: (k) => k },
};
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
global.ui = { notifications: { warn: jest.fn() } };

function makeActor({ energon = 1, flag = undefined } = {}) {
  return {
    system: { energon: { normal: { value: energon } } },
    getFlag: jest.fn(() => flag),
    setFlag: jest.fn(),
    update: jest.fn(),
    _dice: { rollSkill: jest.fn() },
  };
}

beforeEach(() => {
  foundry.applications.api.DialogV2.wait.mockReset();
  ui.notifications.warn.mockReset();
});

describe("canUsePatchUp", () => {
  test("true with Energon and no prior use this turn", () => {
    expect(canUsePatchUp(makeActor({ energon: 1 }))).toBe(true);
  });

  test("false with no Energon", () => {
    expect(canUsePatchUp(makeActor({ energon: 0 }))).toBe(false);
  });

  test("false once already used this turn", () => {
    const actor = makeActor({ flag: { combatId: 'combat1', round: 1, turn: 0 } });
    expect(canUsePatchUp(actor)).toBe(false);
  });
});

describe("activatePatchUp", () => {
  test("warns and does not roll when unavailable", async () => {
    const actor = makeActor({ energon: 0 });

    await activatePatchUp(actor);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("spends Energon, marks the turn used, and rolls the chosen Skill at RAW's own DIF", async () => {
    foundry.applications.api.DialogV2.wait
      .mockResolvedValueOnce('technology')
      .mockResolvedValueOnce(2);
    const actor = makeActor({ energon: 1 });

    await activatePatchUp(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.energon.normal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'patchUpUsedThisTurn',
      expect.objectContaining({ combatId: 'combat1', round: 1, turn: 0 }));
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'technology', essence: 'smarts', dif: '15', isPatchUp: true, patchUpAmount: 2,
      }),
      actor,
    );
  });

  test("does nothing when the skill picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('cancel');
    const actor = makeActor();

    await activatePatchUp(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("does nothing when the amount picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait
      .mockResolvedValueOnce('science')
      .mockResolvedValueOnce('cancel');
    const actor = makeActor();

    await activatePatchUp(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});
