import { jest } from '@jest/globals';
import { isMeatShieldActive, toggleMeatShield, getMeatShieldBonus } from './meat-shield.mjs';

const MEAT_SHIELD_ID = "Compendium.essence20.sgt_slaughter_sourcebook.Item.hYwFDsC7azfYB5fO";

function makeActor({ active = false, level = 1, hasPerk = true } = {}) {
  const flagStore = { meatShieldActive: active };
  return {
    system: { level },
    items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: MEAT_SHIELD_ID } } }] : [],
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isMeatShieldActive / toggleMeatShield", () => {
  test("false by default, true once toggled on, false again once toggled off", async () => {
    const actor = makeActor();
    expect(isMeatShieldActive(actor)).toBe(false);

    await toggleMeatShield(actor);
    expect(isMeatShieldActive(actor)).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'meatShieldActive', true);

    await toggleMeatShield(actor);
    expect(isMeatShieldActive(actor)).toBe(false);
  });
});

describe("getMeatShieldBonus", () => {
  test("0 without the Perk at all, even if somehow toggled on", () => {
    expect(getMeatShieldBonus(makeActor({ hasPerk: false, active: true, level: 20 }))).toBe(0);
  });

  test("0 below 7th level with the toggle off", () => {
    expect(getMeatShieldBonus(makeActor({ level: 1 }))).toBe(0);
  });

  test("the temporary bonus while toggled on, following Personal Shield's own progression", () => {
    expect(getMeatShieldBonus(makeActor({ active: true, level: 1 }))).toBe(2);
    expect(getMeatShieldBonus(makeActor({ active: true, level: 7 }))).toBe(5);
    expect(getMeatShieldBonus(makeActor({ active: true, level: 20 }))).toBe(15);
  });

  test("the permanent bonus once toggled off, starting at 7th level", () => {
    expect(getMeatShieldBonus(makeActor({ active: false, level: 6 }))).toBe(0);
    expect(getMeatShieldBonus(makeActor({ active: false, level: 7 }))).toBe(2);
    expect(getMeatShieldBonus(makeActor({ active: false, level: 12 }))).toBe(3);
    expect(getMeatShieldBonus(makeActor({ active: false, level: 20 }))).toBe(4);
  });

  test("takes the larger of the two rather than stacking them", () => {
    // At 12th level: permanent = 3, temporary (toggled on) = 7 - the larger, not 10.
    expect(getMeatShieldBonus(makeActor({ active: true, level: 12 }))).toBe(7);
  });
});
