import { jest } from '@jest/globals';
import {
  activateAtAllCost, applyAtAllCostDamage, canActivateAtAllCost, deactivateAtAllCost, isAtAllCostActive,
} from './at-all-cost.mjs';

global.game = {
  combat: null,
};

function makeActor({ isMorphed = true, active = false, usedThisEncounter = false, power = 3 } = {}) {
  const flagStore = {
    atAllCostActive: active,
    atAllCostUsedThisEncounter: usedThisEncounter ? { combatId: 'combat1' } : undefined,
  };

  return {
    system: { isMorphed, powers: { personal: { value: power } }, health: { value: 5 } },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn((scope, key, value) => { flagStore[key] = value; }),
    unsetFlag: jest.fn((scope, key) => { flagStore[key] = undefined; }),
    update: jest.fn(),
    toggleStatusEffect: jest.fn(),
  };
}

describe("isAtAllCostActive", () => {
  test("true when the flag is set", () => {
    expect(isAtAllCostActive(makeActor({ active: true }))).toBe(true);
  });

  test("false when the flag isn't set", () => {
    expect(isAtAllCostActive(makeActor({ active: false }))).toBe(false);
  });
});

describe("canActivateAtAllCost", () => {
  test("true while Morphed, inactive, and not yet used this scene", () => {
    expect(canActivateAtAllCost(makeActor())).toBe(true);
  });

  test("false when not Morphed", () => {
    expect(canActivateAtAllCost(makeActor({ isMorphed: false }))).toBe(false);
  });

  test("false when already active", () => {
    expect(canActivateAtAllCost(makeActor({ active: true }))).toBe(false);
  });

  test("false once already used this scene", () => {
    game.combat = { id: 'combat1' };
    expect(canActivateAtAllCost(makeActor({ usedThisEncounter: true }))).toBe(false);
    game.combat = null;
  });
});

describe("activateAtAllCost / deactivateAtAllCost", () => {
  beforeEach(() => {
    game.combat = { id: 'combat1' };
  });
  afterEach(() => {
    game.combat = null;
  });

  test("activate sets the flag and marks the scene used", async () => {
    const actor = makeActor();
    await activateAtAllCost(actor);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'atAllCostActive', true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'atAllCostUsedThisEncounter', expect.anything());
  });

  test("deactivate clears the flag", async () => {
    const actor = makeActor({ active: true });
    await deactivateAtAllCost(actor);
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'atAllCostActive');
  });
});

describe("applyAtAllCostDamage", () => {
  test("converts the amount to Power loss instead of Health", async () => {
    const actor = makeActor({ power: 3 });
    const applied = await applyAtAllCostDamage(actor, 2);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 1 });
    expect(applied).toBe(2);
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test("floors Power at 0 and auto-reverts once it hits 0", async () => {
    const actor = makeActor({ power: 2, active: true });
    const applied = await applyAtAllCostDamage(actor, 5);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('unconscious', { active: true });
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: true });
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'atAllCostActive');
    expect(applied).toBe(2); // only the 2 Power actually available were converted
  });

  test("doesn't auto-revert when Power stays above 0", async () => {
    const actor = makeActor({ power: 5, active: true });
    await applyAtAllCostDamage(actor, 2);

    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });
});
