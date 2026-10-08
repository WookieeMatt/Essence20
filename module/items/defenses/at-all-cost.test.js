import { jest } from '@jest/globals';
import {
  applyAtAllCostDamage, isAtAllCostActive,
} from './at-all-cost.mjs';

global.game = {
  combat: null,
};

function makeActor({ isMorphed = true, active = false, usedThisEncounter = false, power = 3 } = {}) {
  const flagStore = {
    atAllCostActive: active,
    atAllCostUsedThisEncounter: usedThisEncounter ? { epoch: 1, window: 'encounter', count: 1 } : undefined,
  };

  return {
    system: { isMorphed, powers: { personal: { value: power } }, health: { value: 5 } },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn((scope, key, value) => {
      flagStore[key] = value; 
    }),
    unsetFlag: jest.fn((scope, key) => {
      flagStore[key] = undefined; 
    }),
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
