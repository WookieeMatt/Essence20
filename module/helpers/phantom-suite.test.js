import { jest } from '@jest/globals';
import {
  deactivatePhantomSuite, getPhantomSuiteEvasionBonus, isPhantomSuiteActive, togglePhantomSuite,
} from './phantom-suite.mjs';

const PHANTOM_SUITE_ID = "Compendium.essence20.across_the_stars.Item.fQgxo5c7tNOD2Q5K";

function makeActor({ active = false, power = 1, hasPerk = true, currentValue = 2 } = {}) {
  const flagStore = { phantomSuiteActive: active };
  const items = hasPerk
    ? [{ type: 'perk', flags: { core: { sourceId: PHANTOM_SUITE_ID } }, system: { advances: { currentValue } } }]
    : [];

  return {
    items,
    system: { powers: { personal: { value: power } } },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    update: jest.fn(),
  };
}

describe("isPhantomSuiteActive", () => {
  test("false by default", () => {
    expect(isPhantomSuiteActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isPhantomSuiteActive(makeActor({ active: true }))).toBe(true);
  });
});

describe("togglePhantomSuite", () => {
  test("activates and spends 1 Personal Power when affordable", async () => {
    const actor = makeActor({ power: 1 });
    const result = await togglePhantomSuite(actor);

    expect(result).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'phantomSuiteActive', true);
  });

  test("returns null and spends nothing when unaffordable", async () => {
    const actor = makeActor({ power: 0 });
    const result = await togglePhantomSuite(actor);

    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("deactivates for free", async () => {
    const actor = makeActor({ active: true, power: 0 });
    const result = await togglePhantomSuite(actor);

    expect(result).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'phantomSuiteActive', false);
  });
});

describe("deactivatePhantomSuite", () => {
  test("switches it off with no Power refund", async () => {
    const actor = makeActor({ active: true, power: 0 });
    await deactivatePhantomSuite(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'phantomSuiteActive', false);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("no-ops if it wasn't active", async () => {
    const actor = makeActor({ active: false });
    await deactivatePhantomSuite(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("getPhantomSuiteEvasionBonus", () => {
  test("reads the Perk's own current advance value", () => {
    expect(getPhantomSuiteEvasionBonus(makeActor({ currentValue: 4 }))).toBe(4);
  });

  test("returns 0 without the Perk", () => {
    expect(getPhantomSuiteEvasionBonus(makeActor({ hasPerk: false }))).toBe(0);
  });
});
