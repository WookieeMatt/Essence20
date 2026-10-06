import { jest } from '@jest/globals';
import { activateGrowl, canUseGrowl } from './growl.mjs';

global.game = {
  combat: { id: 'combat1', round: 1, turn: 0 },
  user: { targets: { first: jest.fn() } },
};
global.ui = { notifications: { warn: jest.fn() } };
global.game.i18n = { localize: (k) => k };

function makeActor({ flag = undefined } = {}) {
  return {
    getFlag: jest.fn(() => flag),
    setFlag: jest.fn(),
    _dice: { rollSkill: jest.fn() },
  };
}

beforeEach(() => {
  ui.notifications.warn.mockReset();
  game.user.targets.first.mockReset();
});

describe("canUseGrowl", () => {
  test("true with no prior use this turn", () => {
    expect(canUseGrowl(makeActor(), 'enemy1')).toBe(true);
  });

  test("false once already used against this target this turn", () => {
    const actor = makeActor({
      flag: { combatId: 'combat1', round: 1, turn: 0, targetIds: ['enemy1'] },
    });
    expect(canUseGrowl(actor, 'enemy1')).toBe(false);
  });

  test("true against a DIFFERENT target even if one was already used this turn", () => {
    const actor = makeActor({
      flag: { combatId: 'combat1', round: 1, turn: 0, targetIds: ['enemy1'] },
    });
    expect(canUseGrowl(actor, 'enemy2')).toBe(true);
  });

  test("true again next turn (stale record)", () => {
    const actor = makeActor({
      flag: { combatId: 'combat1', round: 1, turn: 1, targetIds: ['enemy1'] },
    });
    expect(canUseGrowl(actor, 'enemy1')).toBe(true);
  });

  test("false outside combat", () => {
    game.combat = null;
    expect(canUseGrowl(makeActor(), 'enemy1')).toBe(false);
    game.combat = { id: 'combat1', round: 1, turn: 0 };
  });
});

describe("activateGrowl", () => {
  test("warns and does not roll with no target", async () => {
    game.user.targets.first.mockReturnValue(undefined);
    const actor = makeActor();

    await activateGrowl(actor);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("warns and does not roll when already used against this target this turn", async () => {
    game.user.targets.first.mockReturnValue({ actor: { id: 'enemy1' } });
    const actor = makeActor({
      flag: { combatId: 'combat1', round: 1, turn: 0, targetIds: ['enemy1'] },
    });

    await activateGrowl(actor);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("marks the target used and rolls Intimidation against Willpower", async () => {
    game.user.targets.first.mockReturnValue({ actor: { id: 'enemy1' } });
    const actor = makeActor();

    await activateGrowl(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'growlTargetsThisTurn',
      expect.objectContaining({ targetIds: ['enemy1'] }));
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'intimidation', essence: 'strength', defenseType: 'willpower', isGrowl: true }),
      actor,
    );
  });
});
