import { jest } from '@jest/globals';
import { syncDangerSenseInitiative } from './danger-sense.mjs';

global.game = {
  i18n: { localize: (key) => key, format: (key) => key },
  combat: null,
};
global.ui = { notifications: { warn: jest.fn() } };
global.fromUuid = jest.fn();

function makeActor({ id = 'bodyguard1', protectedUuid } = {}) {
  return {
    id,
    getFlag: jest.fn((scope, key) => (
      scope == 'essence20' && key == 'protectedTargetUuid' ? protectedUuid : undefined
    )),
  };
}

function makeCombatant({ actorId, initiative }) {
  return { actor: { id: actorId }, initiative, update: jest.fn() };
}

describe("syncDangerSenseInitiative", () => {
  beforeEach(() => {
    ui.notifications.warn.mockReset();
    fromUuid.mockReset();
  });

  test("sets the Protected Target's Combatant#initiative equal to the actor's own", async () => {
    const actor = makeActor({ protectedUuid: 'Actor.target1' });
    const protectedTarget = { id: 'target1' };
    fromUuid.mockResolvedValue(protectedTarget);
    const myCombatant = makeCombatant({ actorId: 'bodyguard1', initiative: 18 });
    const targetCombatant = makeCombatant({ actorId: 'target1', initiative: 5 });
    game.combat = { combatants: [myCombatant, targetCombatant] };

    const result = await syncDangerSenseInitiative(actor);

    expect(result).toBe(true);
    expect(targetCombatant.update).toHaveBeenCalledWith({ initiative: 18 });
  });

  test("warns and does nothing outside combat", async () => {
    game.combat = null;
    const actor = makeActor({ protectedUuid: 'Actor.target1' });

    const result = await syncDangerSenseInitiative(actor);

    expect(result).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("warns and does nothing without a Protected Target designated", async () => {
    game.combat = { combatants: [] };
    const actor = makeActor({ protectedUuid: undefined });

    const result = await syncDangerSenseInitiative(actor);

    expect(result).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("warns and does nothing when either side hasn't rolled Initiative yet", async () => {
    const actor = makeActor({ protectedUuid: 'Actor.target1' });
    const protectedTarget = { id: 'target1' };
    fromUuid.mockResolvedValue(protectedTarget);
    const myCombatant = makeCombatant({ actorId: 'bodyguard1', initiative: null });
    const targetCombatant = makeCombatant({ actorId: 'target1', initiative: 5 });
    game.combat = { combatants: [myCombatant, targetCombatant] };

    const result = await syncDangerSenseInitiative(actor);

    expect(result).toBe(false);
    expect(targetCombatant.update).not.toHaveBeenCalled();
  });

  test("warns and does nothing when the Protected Target isn't seated in this combat", async () => {
    const actor = makeActor({ protectedUuid: 'Actor.target1' });
    const protectedTarget = { id: 'target1' };
    fromUuid.mockResolvedValue(protectedTarget);
    const myCombatant = makeCombatant({ actorId: 'bodyguard1', initiative: 18 });
    game.combat = { combatants: [myCombatant] };

    const result = await syncDangerSenseInitiative(actor);

    expect(result).toBe(false);
  });
});
