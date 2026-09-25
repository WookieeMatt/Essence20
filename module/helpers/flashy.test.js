import { jest } from '@jest/globals';
import { activateFlashy, applyFlashyBlinded } from './flashy.mjs';

global.game = {
  i18n: { localize: (key) => key },
  user: { targets: { first: jest.fn(() => undefined) } },
};
global.ui = { notifications: { warn: jest.fn() } };

function makeActor() {
  return { _dice: { rollSkill: jest.fn() } };
}

beforeEach(() => {
  ui.notifications.warn.mockClear();
  game.user.targets.first.mockReturnValue(undefined);
});

describe("activateFlashy", () => {
  test("triggers a Science roll against the target's Toughness", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue({ actor: {} });

    await activateFlashy(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'science', defenseType: 'toughness', isFlashyAttempt: true }), actor,
    );
  });

  test("warns and does nothing without a target", async () => {
    const actor = makeActor();

    await activateFlashy(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  describe("Technologist (Transformers CRB, Gadgeteer Focus, 1st level, p.81)", () => {
    const TECHNOLOGIST_ID = "Compendium.essence20.tf_crb.Item.tdFzQ0IOtoHQ0vmy";

    function makeTechnologistActor({ science = 'd8', technology = 'd8' } = {}) {
      return {
        _dice: { rollSkill: jest.fn() },
        items: [{ type: 'perk', flags: { core: { sourceId: TECHNOLOGIST_ID } } }],
        getRollData: () => ({ skills: { science: { shift: science }, technology: { shift: technology } } }),
      };
    }

    test("substitutes Technology when it's better than Science", async () => {
      const actor = makeTechnologistActor({ science: 'd8', technology: 'd12' });
      game.user.targets.first.mockReturnValue({ actor: {} });

      await activateFlashy(actor);

      expect(actor._dice.rollSkill).toHaveBeenCalledWith(
        expect.objectContaining({ skill: 'technology' }), actor,
      );
    });

    test("keeps Science when it's already at least as good", async () => {
      const actor = makeTechnologistActor({ science: 'd12', technology: 'd8' });
      game.user.targets.first.mockReturnValue({ actor: {} });

      await activateFlashy(actor);

      expect(actor._dice.rollSkill).toHaveBeenCalledWith(
        expect.objectContaining({ skill: 'science' }), actor,
      );
    });
  });
});

describe("applyFlashyBlinded", () => {
  test("toggles the Blinded status on the target", async () => {
    const target = { toggleStatusEffect: jest.fn() };

    await applyFlashyBlinded(target);

    expect(target.toggleStatusEffect).toHaveBeenCalledWith('blinded', { active: true });
  });
});
