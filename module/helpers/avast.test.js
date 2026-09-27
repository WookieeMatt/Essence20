import { jest } from '@jest/globals';
import { activateAvast, applyAvastInitiativePenalty } from './avast.mjs';

global.game = { user: { targets: { first: jest.fn() } } };

function makeActor() {
  return { _dice: { rollSkill: jest.fn() } };
}

describe("activateAvast", () => {
  afterEach(() => {
    game.user.targets.first.mockReset();
  });

  test("rolls Intimidation vs Willpower against the currently-targeted actor", async () => {
    const actor = makeActor();
    const targetActor = { uuid: 'Actor.target1' };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = await activateAvast(actor);

    expect(result).toBe(targetActor);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'intimidation', defenseType: 'willpower', isAvastAttempt: true,
        avastTargetUuid: 'Actor.target1',
      }),
      actor,
    );
  });

  test("returns null and rolls nothing with no target selected", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(undefined);

    const result = await activateAvast(actor);

    expect(result).toBeNull();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("applyAvastInitiativePenalty", () => {
  afterEach(() => {
    game.combat = undefined;
  });

  function makeCombatant(id, initiative) {
    return { id, actor: { uuid: 'Actor.target1' }, initiative, update: jest.fn() };
  }

  test("does nothing with no active combat", async () => {
    game.combat = null;
    const result = await applyAvastInitiativePenalty({ uuid: 'Actor.target1' });
    expect(result).toBe(false);
  });

  test("does nothing when the target isn't a seated, already-rolled combatant", async () => {
    game.combat = { combatants: { find: jest.fn(() => undefined) } };
    const result = await applyAvastInitiativePenalty({ uuid: 'Actor.target1' });
    expect(result).toBe(false);
  });

  test("keeps the new roll when it's worse (higher) than the old one", async () => {
    const combatant = makeCombatant('c1', 5);
    const rerolled = makeCombatant('c1', 15);
    const rollInitiative = jest.fn(async () => {
      combatant.initiative = 15;
    });
    game.combat = {
      combatants: {
        find: jest.fn(() => combatant),
        get: jest.fn(() => rerolled),
      },
      rollInitiative,
    };

    const result = await applyAvastInitiativePenalty({ uuid: 'Actor.target1' });

    expect(rollInitiative).toHaveBeenCalledWith(['c1']);
    expect(rerolled.update).toHaveBeenCalledWith({ initiative: 5 });
    expect(result).toBe(true);
  });

  test("leaves the new roll in place when it's already lower (better for the target to keep)", async () => {
    const combatant = makeCombatant('c1', 15);
    const rerolled = makeCombatant('c1', 5);
    game.combat = {
      combatants: {
        find: jest.fn(() => combatant),
        get: jest.fn(() => rerolled),
      },
      rollInitiative: jest.fn(async () => {}),
    };

    const result = await applyAvastInitiativePenalty({ uuid: 'Actor.target1' });

    expect(rerolled.update).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });
});
