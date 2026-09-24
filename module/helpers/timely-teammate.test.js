import { jest } from '@jest/globals';
import { activateTimelyTeammate, canUseTimelyTeammate } from './timely-teammate.mjs';

global.game = {
  i18n: {
    localize: (key) => key,
  },
  user: {
    targets: {
      first: jest.fn(() => undefined),
    },
  },
  combat: null,
};

global.ui = {
  notifications: {
    warn: jest.fn(),
  },
};

function makeActor(id) {
  return { id, getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
}

function makeCombatant(actor, initiative) {
  return { actor, initiative, update: jest.fn(async function (data) {
    this.initiative = data.initiative; 
  }) };
}

describe("canUseTimelyTeammate", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("true in combat when not yet used this encounter", () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor('actor1');
    expect(canUseTimelyTeammate(actor)).toBe(true);
  });

  test("false outside combat", () => {
    game.combat = null;
    const actor = makeActor('actor1');
    expect(canUseTimelyTeammate(actor)).toBe(false);
  });

  test("false once already used this combat", () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor('actor1');
    actor.getFlag = jest.fn(() => ({ epoch: 1, window: 'encounter', count: 1 }));
    expect(canUseTimelyTeammate(actor)).toBe(false);
  });
});

describe("activateTimelyTeammate", () => {
  beforeEach(() => {
    game.user.targets.first.mockReset();
    ui.notifications.warn.mockClear();
  });

  afterEach(() => {
    game.combat = null;
  });

  test("swaps the actor's and the targeted ally's Initiative and marks the encounter used", async () => {
    const actor = makeActor('actor1');
    const targetActor = makeActor('actor2');
    const actorCombatant = makeCombatant(actor, 10);
    const targetCombatant = makeCombatant(targetActor, 18);
    game.combat = { id: 'combat1', combatants: [actorCombatant, targetCombatant] };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await activateTimelyTeammate(actor);

    expect(result).toBe(true);
    expect(actorCombatant.update).toHaveBeenCalledWith({ initiative: 18 });
    expect(targetCombatant.update).toHaveBeenCalledWith({ initiative: 10 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'timelyTeammateUsedThisEncounter', { epoch: 1, window: 'encounter', count: 1 });
  });

  test("warns and does nothing when nothing is targeted", async () => {
    const actor = makeActor('actor1');
    game.combat = { id: 'combat1', combatants: [makeCombatant(actor, 10)] };
    game.user.targets.first.mockReturnValue(undefined);

    const result = await activateTimelyTeammate(actor);

    expect(result).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.TimelyTeammateNoTarget');
  });

  test("warns and does nothing when the target isn't in the current combat", async () => {
    const actor = makeActor('actor1');
    const targetActor = makeActor('actor2');
    game.combat = { id: 'combat1', combatants: [makeCombatant(actor, 10)] };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await activateTimelyTeammate(actor);

    expect(result).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.TimelyTeammateNotInCombat');
  });

  test("does nothing outside combat", async () => {
    game.combat = null;
    const actor = makeActor('actor1');

    const result = await activateTimelyTeammate(actor);

    expect(result).toBe(false);
  });

  test("does nothing once already used this combat", async () => {
    const actor = makeActor('actor1');
    actor.getFlag = jest.fn(() => ({ epoch: 1, window: 'encounter', count: 1 }));
    const targetActor = makeActor('actor2');
    game.combat = {
      id: 'combat1', combatants: [makeCombatant(actor, 10), makeCombatant(targetActor, 18)],
    };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await activateTimelyTeammate(actor);

    expect(result).toBe(false);
  });
});
