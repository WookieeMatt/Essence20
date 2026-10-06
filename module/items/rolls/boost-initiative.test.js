import { jest } from '@jest/globals';
import { activateBoostInitiative } from './boost-initiative.mjs';

function makeActor(id = 'actor1') {
  return { id };
}

function makeCombatant(actor, initiative) {
  return { actor, initiative, update: jest.fn(async function (data) {
    this.initiative = data.initiative; 
  }) };
}

describe("activateBoostInitiative", () => {
  test("adds +2 per Power spent to the actor's own current Initiative", async () => {
    const actor = makeActor();
    const combatant = makeCombatant(actor, 10);
    global.game = { combat: { combatants: [combatant] } };

    const result = await activateBoostInitiative(actor, 3);

    expect(result).toBe(true);
    expect(combatant.update).toHaveBeenCalledWith({ initiative: 16 });
  });

  test("does nothing when nothing was spent", async () => {
    const actor = makeActor();
    const combatant = makeCombatant(actor, 10);
    global.game = { combat: { combatants: [combatant] } };

    const result = await activateBoostInitiative(actor, 0);

    expect(result).toBe(false);
    expect(combatant.update).not.toHaveBeenCalled();
  });

  test("does nothing outside of combat", async () => {
    const actor = makeActor();
    global.game = { combat: null };

    const result = await activateBoostInitiative(actor, 2);

    expect(result).toBe(false);
  });

  test("does nothing when the actor hasn't rolled Initiative yet", async () => {
    const actor = makeActor();
    const combatant = makeCombatant(actor, null);
    global.game = { combat: { combatants: [combatant] } };

    const result = await activateBoostInitiative(actor, 2);

    expect(result).toBe(false);
    expect(combatant.update).not.toHaveBeenCalled();
  });

  test("does nothing when the actor isn't in the current combat", async () => {
    const actor = makeActor('actor1');
    const otherCombatant = makeCombatant(makeActor('actor2'), 10);
    global.game = { combat: { combatants: [otherCombatant] } };

    const result = await activateBoostInitiative(actor, 2);

    expect(result).toBe(false);
  });
});
