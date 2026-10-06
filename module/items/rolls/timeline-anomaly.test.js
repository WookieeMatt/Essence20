import { jest } from '@jest/globals';
import { swapInitiativeWithTarget } from './timeline-anomaly.mjs';

global.game = {
  i18n: { localize: (key) => key },
  user: { targets: { first: jest.fn(() => undefined) } },
  combat: null,
};

global.ui = { notifications: { warn: jest.fn() } };

describe("swapInitiativeWithTarget", () => {
  beforeEach(() => {
    game.user.targets.first.mockReset();
    ui.notifications.warn.mockClear();
    game.combat = null;
  });

  function makeCombatant(actorId, initiative) {
    return { actor: { id: actorId }, initiative, update: jest.fn() };
  }

  test("swaps the two Combatants' own Initiative values", async () => {
    const actor = { id: 'actor1' };
    const targetActor = { id: 'target1' };
    const actorCombatant = makeCombatant('actor1', 5);
    const targetCombatant = makeCombatant('target1', 15);
    game.combat = { combatants: [actorCombatant, targetCombatant] };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await swapInitiativeWithTarget(actor);

    expect(result).toBe(true);
    expect(actorCombatant.update).toHaveBeenCalledWith({ initiative: 15 });
    expect(targetCombatant.update).toHaveBeenCalledWith({ initiative: 5 });
  });

  test("warns and does nothing outside of combat", async () => {
    const actor = { id: 'actor1' };
    game.combat = null;

    const result = await swapInitiativeWithTarget(actor);

    expect(result).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.TimelineAnomalyNoCombat');
  });

  test("warns and does nothing with no target selected", async () => {
    const actor = { id: 'actor1' };
    game.combat = { combatants: [makeCombatant('actor1', 5)] };
    game.user.targets.first.mockReturnValue(undefined);

    const result = await swapInitiativeWithTarget(actor);

    expect(result).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.TimelineAnomalyNoTarget');
  });

  test("warns and does nothing when the target isn't actually in this Combat", async () => {
    const actor = { id: 'actor1' };
    const targetActor = { id: 'target1' };
    game.combat = { combatants: [makeCombatant('actor1', 5)] };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await swapInitiativeWithTarget(actor);

    expect(result).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.TimelineAnomalyNoTarget');
  });

  test("warns and does nothing when the actor's own Combatant can't be found", async () => {
    const actor = { id: 'actor1' };
    const targetActor = { id: 'target1' };
    game.combat = { combatants: [makeCombatant('target1', 15)] };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await swapInitiativeWithTarget(actor);

    expect(result).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.TimelineAnomalyNoTarget');
  });

  describe("requireLowerTarget (After You, MLP CRB, Spirit of Generosity, 6th level, p.76)", () => {
    test("swaps when the target rolled lower", async () => {
      const actor = { id: 'actor1' };
      const targetActor = { id: 'target1' };
      const actorCombatant = makeCombatant('actor1', 15);
      const targetCombatant = makeCombatant('target1', 5);
      game.combat = { combatants: [actorCombatant, targetCombatant] };
      game.user.targets.first.mockReturnValue({ actor: targetActor });

      const result = await swapInitiativeWithTarget(actor, { requireLowerTarget: true });

      expect(result).toBe(true);
      expect(actorCombatant.update).toHaveBeenCalledWith({ initiative: 5 });
      expect(targetCombatant.update).toHaveBeenCalledWith({ initiative: 15 });
    });

    test("warns and does nothing when the target rolled higher", async () => {
      const actor = { id: 'actor1' };
      const targetActor = { id: 'target1' };
      const actorCombatant = makeCombatant('actor1', 5);
      const targetCombatant = makeCombatant('target1', 15);
      game.combat = { combatants: [actorCombatant, targetCombatant] };
      game.user.targets.first.mockReturnValue({ actor: targetActor });

      const result = await swapInitiativeWithTarget(actor, { requireLowerTarget: true });

      expect(result).toBe(false);
      expect(ui.notifications.warn).toHaveBeenCalledWith('E20.AfterYouMustRollLower');
      expect(actorCombatant.update).not.toHaveBeenCalled();
    });

    test("warns and does nothing on a tie", async () => {
      const actor = { id: 'actor1' };
      const targetActor = { id: 'target1' };
      const actorCombatant = makeCombatant('actor1', 10);
      const targetCombatant = makeCombatant('target1', 10);
      game.combat = { combatants: [actorCombatant, targetCombatant] };
      game.user.targets.first.mockReturnValue({ actor: targetActor });

      const result = await swapInitiativeWithTarget(actor, { requireLowerTarget: true });

      expect(result).toBe(false);
      expect(ui.notifications.warn).toHaveBeenCalledWith('E20.AfterYouMustRollLower');
    });
  });
});
