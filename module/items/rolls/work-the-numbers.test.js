import { jest } from '@jest/globals';
import { activateWorkTheNumbers, canUseWorkTheNumbers } from './work-the-numbers.mjs';

function makeCombatant(id, actorId, initiative) {
  return { id, actor: { id: actorId }, initiative, update: jest.fn() };
}

function setGame({ combat = null, targetActor = null, direction = 'up' } = {}) {
  global.game = {
    combat,
    user: { targets: { first: () => (targetActor ? { actor: targetActor } : undefined) } },
    i18n: { localize: (k) => k, format: (k) => k },
  };
  global.foundry = { applications: { api: { DialogV2: { wait: jest.fn(() => direction) } } } };
}

describe("canUseWorkTheNumbers", () => {
  test("false outside combat", () => {
    setGame({ combat: null });
    expect(canUseWorkTheNumbers()).toBe(false);
  });

  test("false during round 1", () => {
    setGame({ combat: { round: 1 } });
    expect(canUseWorkTheNumbers()).toBe(false);
  });

  test("true from round 2 onward", () => {
    setGame({ combat: { round: 2 } });
    expect(canUseWorkTheNumbers()).toBe(true);
  });
});

describe("activateWorkTheNumbers", () => {
  test("moves the targeted combatant up one place, past its neighbor above", async () => {
    const first = makeCombatant('c1', 'a1', 20);
    const second = makeCombatant('c2', 'a2', 15);
    const third = makeCombatant('c3', 'a3', 10);
    const turns = [first, second, third];
    setGame({
      combat: { round: 2, turns, combatants: turns },
      targetActor: { id: 'a3' },
      direction: 'up',
    });

    const result = await activateWorkTheNumbers();

    expect(result).toBe(true);
    expect(third.update).toHaveBeenCalledWith({ initiative: 15.01 });
  });

  test("moves the targeted combatant down one place, past its neighbor below", async () => {
    const first = makeCombatant('c1', 'a1', 20);
    const second = makeCombatant('c2', 'a2', 15);
    const third = makeCombatant('c3', 'a3', 10);
    const turns = [first, second, third];
    setGame({
      combat: { round: 2, turns, combatants: turns },
      targetActor: { id: 'a1' },
      direction: 'down',
    });

    const result = await activateWorkTheNumbers();

    expect(result).toBe(true);
    expect(first.update).toHaveBeenCalledWith({ initiative: 14.99 });
  });

  test("returns false outside combat or during round 1", async () => {
    setGame({ combat: null });
    expect(await activateWorkTheNumbers()).toBe(false);

    setGame({ combat: { round: 1 } });
    expect(await activateWorkTheNumbers()).toBe(false);
  });

  test("returns false with no valid target", async () => {
    setGame({ combat: { round: 2, turns: [], combatants: [] }, targetActor: null });
    expect(await activateWorkTheNumbers()).toBe(false);
  });

  test("returns false when there's no neighbor in that direction (already at the end)", async () => {
    const first = makeCombatant('c1', 'a1', 20);
    const second = makeCombatant('c2', 'a2', 15);
    const turns = [first, second];
    setGame({ combat: { round: 2, turns, combatants: turns }, targetActor: { id: 'a1' }, direction: 'up' });

    const result = await activateWorkTheNumbers();

    expect(result).toBe(false);
    expect(first.update).not.toHaveBeenCalled();
  });

  test("returns false when the direction picker is cancelled", async () => {
    const first = makeCombatant('c1', 'a1', 20);
    const second = makeCombatant('c2', 'a2', 15);
    const turns = [first, second];
    setGame({ combat: { round: 2, turns, combatants: turns }, targetActor: { id: 'a2' } });
    foundry.applications.api.DialogV2.wait.mockImplementation(() => 'cancel');

    const result = await activateWorkTheNumbers();

    expect(result).toBe(false);
  });
});
