import { jest } from '@jest/globals';
import { activateRightBehindYou } from './right-behind-you.mjs';

function makeCombatant(actorId, initiative) {
  return { actor: { id: actorId }, initiative, update: jest.fn() };
}

function setGame({ combat = null, targetActor = null } = {}) {
  global.game = { combat, user: { targets: { first: () => (targetActor ? { actor: targetActor } : undefined) } } };
}

describe("activateRightBehindYou", () => {
  test("sets Initiative to just below the targeted ally's own result", async () => {
    const selfCombatant = makeCombatant('self', 5);
    const allyCombatant = makeCombatant('ally', 15);
    setGame({ combat: { round: 1, combatants: [selfCombatant, allyCombatant] }, targetActor: { id: 'ally' } });

    const result = await activateRightBehindYou({ id: 'self' });

    expect(result).toBe(true);
    expect(selfCombatant.update).toHaveBeenCalledWith({ initiative: 14.99 });
  });

  test("returns false outside combat", async () => {
    setGame({ combat: null });
    const result = await activateRightBehindYou({ id: 'self' });
    expect(result).toBe(false);
  });

  test("returns false after round 1", async () => {
    setGame({ combat: { round: 2, combatants: [] } });
    const result = await activateRightBehindYou({ id: 'self' });
    expect(result).toBe(false);
  });

  test("returns false with no ally targeted", async () => {
    setGame({ combat: { round: 1, combatants: [makeCombatant('self', 5)] }, targetActor: null });
    const result = await activateRightBehindYou({ id: 'self' });
    expect(result).toBe(false);
  });

  test("returns false when the targeted ally isn't in this combat, or hasn't rolled Initiative", async () => {
    const selfCombatant = makeCombatant('self', 5);
    setGame({ combat: { round: 1, combatants: [selfCombatant] }, targetActor: { id: 'ally' } });

    const result = await activateRightBehindYou({ id: 'self' });

    expect(result).toBe(false);
    expect(selfCombatant.update).not.toHaveBeenCalled();
  });
});
