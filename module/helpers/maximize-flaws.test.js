import { jest } from '@jest/globals';
import { activateMaximizeFlaws, getMaximizeFlawsTargetUuid } from './maximize-flaws.mjs';

function setGame({ combat = null, targetActor = null } = {}) {
  global.game = { combat, user: { targets: { first: () => (targetActor ? { actor: targetActor } : undefined) } } };
}

function makeActor({ power = 1, flag = null } = {}) {
  const flagStore = {};
  if (flag) {
    flagStore.maximizeFlawsTarget = flag;
  }

  return {
    system: { powers: { personal: { value: power } } },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    update: jest.fn(),
  };
}

describe("getMaximizeFlawsTargetUuid", () => {
  test("null with no bank", () => {
    setGame({ combat: { id: 'combat1', round: 1, turn: 0 } });
    expect(getMaximizeFlawsTargetUuid(makeActor())).toBeNull();
  });

  test("returns the banked target's uuid when the bank is still current this turn", () => {
    setGame({ combat: { id: 'combat1', round: 1, turn: 0 } });
    const actor = makeActor({ flag: { combatId: 'combat1', round: 1, turn: 0, targetUuid: 'Actor.enemy1' } });
    expect(getMaximizeFlawsTargetUuid(actor)).toBe('Actor.enemy1');
  });

  test("null once the turn has moved on (a stale bank)", () => {
    setGame({ combat: { id: 'combat1', round: 1, turn: 1 } });
    const actor = makeActor({ flag: { combatId: 'combat1', round: 1, turn: 0, targetUuid: 'Actor.enemy1' } });
    expect(getMaximizeFlawsTargetUuid(actor)).toBeNull();
  });
});

describe("activateMaximizeFlaws", () => {
  test("spends 1 Power and banks the targeted enemy for this turn", async () => {
    setGame({ combat: { id: 'combat1', round: 1, turn: 0 }, targetActor: { uuid: 'Actor.enemy1' } });
    const actor = makeActor({ power: 1 });

    const result = await activateMaximizeFlaws(actor);

    expect(result).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'maximizeFlawsTarget', { combatId: 'combat1', round: 1, turn: 0, targetUuid: 'Actor.enemy1' },
    );
  });

  test("returns false with no target selected", async () => {
    setGame({ combat: { id: 'combat1', round: 1, turn: 0 }, targetActor: null });
    const actor = makeActor({ power: 1 });

    const result = await activateMaximizeFlaws(actor);

    expect(result).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("returns false when unaffordable", async () => {
    setGame({ combat: { id: 'combat1', round: 1, turn: 0 }, targetActor: { uuid: 'Actor.enemy1' } });
    const actor = makeActor({ power: 0 });

    const result = await activateMaximizeFlaws(actor);

    expect(result).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
  });
});
