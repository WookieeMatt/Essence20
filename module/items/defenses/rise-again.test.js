import { jest } from '@jest/globals';
import {
  canUseRiseAgainDefense, consumeRiseAgainDefense, RISE_AGAIN_ID,
} from './rise-again.mjs';

global.game = { combat: { id: 'combat1', round: 1, turn: 0 } };

function makeActor({ hasPerk = true, isMorphed = false, usedFlags = {} } = {}) {
  const items = hasPerk ? [{ type: 'perk', flags: { core: { sourceId: RISE_AGAIN_ID } } }] : [];
  items.get = jest.fn(() => null);

  return {
    items,
    system: { isMorphed },
    getFlag: jest.fn((scope, key) => (scope == 'essence20' ? usedFlags[key] : undefined)),
    setFlag: jest.fn(),
    unsetFlag: jest.fn(),
  };
}

describe("canUseRiseAgainDefense", () => {
  test("true when not yet used this scene", () => {
    expect(canUseRiseAgainDefense(makeActor())).toBe(true);
  });

  test("false if already used this scene", () => {
    const usedFlags = { riseAgainDefenseUsedThisEncounter: { epoch: 1, window: 'encounter', count: 1 } };
    expect(canUseRiseAgainDefense(makeActor({ usedFlags }))).toBe(false);
  });
});

describe("consumeRiseAgainDefense", () => {
  test("returns and clears the banked bonus for the matching Defense", async () => {
    const usedFlags = {
      pendingRiseAgainDefense: { defenseType: 'toughness', defenseBonus: 5, combatId: 'combat1', round: 1 },
    };
    const actor = makeActor({ usedFlags });

    expect(await consumeRiseAgainDefense(actor, 'toughness')).toBe(5);
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'pendingRiseAgainDefense');
  });

  test("returns 0 for a non-matching Defense and doesn't clear it", async () => {
    const usedFlags = {
      pendingRiseAgainDefense: { defenseType: 'toughness', defenseBonus: 5, combatId: 'combat1', round: 1 },
    };
    const actor = makeActor({ usedFlags });

    expect(await consumeRiseAgainDefense(actor, 'evasion')).toBe(0);
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });

  test("returns 0 with nothing banked", async () => {
    expect(await consumeRiseAgainDefense(makeActor(), 'toughness')).toBe(0);
  });
});
