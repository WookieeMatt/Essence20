import { jest } from '@jest/globals';
import { activateSelfRevive, canUseSelfRevive } from './self-revive.mjs';

function makeActor({ defeated = true, usedFlag = undefined } = {}) {
  const flagStore = { selfReviveUsedThisEncounter: usedFlag };
  return {
    statuses: new Set(defeated ? ['defeated'] : []),
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    update: jest.fn(),
    toggleStatusEffect: jest.fn(),
  };
}

global.game = { combat: { id: 'combat1', round: 1, turn: 0 } };

describe("canUseSelfRevive", () => {
  test("true while Defeated and not yet used this combat", () => {
    expect(canUseSelfRevive(makeActor({ defeated: true }))).toBe(true);
  });

  test("false when not Defeated", () => {
    expect(canUseSelfRevive(makeActor({ defeated: false }))).toBe(false);
  });

  test("false once already used this combat", () => {
    const actor = makeActor({ defeated: true, usedFlag: { combatId: 'combat1' } });
    expect(canUseSelfRevive(actor)).toBe(false);
  });

  test("true again in a new combat, despite a stale flag from an earlier one", () => {
    const actor = makeActor({ defeated: true, usedFlag: { combatId: 'oldCombat' } });
    expect(canUseSelfRevive(actor)).toBe(true);
  });
});

describe("activateSelfRevive", () => {
  test("regains 1 Health, clears Defeated, and marks this combat used", async () => {
    const actor = makeActor({ defeated: true });

    await activateSelfRevive(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 1 });
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: false });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'selfReviveUsedThisEncounter', expect.objectContaining({ combatId: 'combat1' }),
    );
  });
});
