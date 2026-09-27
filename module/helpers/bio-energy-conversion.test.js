import { jest } from '@jest/globals';
import {
  activateBioEnergyConversion, canUseBioEnergyConversion, isBioEnergyConversionActive,
} from './bio-energy-conversion.mjs';

function makeActor(flagStore = {}) {
  return {
    getFlag: jest.fn((scope, key) => (scope == 'essence20' ? flagStore[key] : undefined)),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("canUseBioEnergyConversion", () => {
  test("always usable - only gated by the Standard action cost", () => {
    expect(canUseBioEnergyConversion()).toBe(true);
  });
});

describe("activateBioEnergyConversion / isBioEnergyConversionActive", () => {
  test("is not active before it's used", () => {
    global.game = { combat: { id: 'combat1', round: 2 } };
    const actor = makeActor();
    expect(isBioEnergyConversionActive(actor)).toBe(false);
  });

  test("is active on the round right after it's banked", async () => {
    global.game = { combat: { id: 'combat1', round: 1 } };
    const actor = makeActor();
    await activateBioEnergyConversion(actor);

    global.game.combat.round = 2;
    expect(isBioEnergyConversionActive(actor)).toBe(true);
  });

  test("is not active the same round it was used, or two rounds later", async () => {
    global.game = { combat: { id: 'combat1', round: 1 } };
    const actor = makeActor();
    await activateBioEnergyConversion(actor);

    expect(isBioEnergyConversionActive(actor)).toBe(false);

    global.game.combat.round = 3;
    expect(isBioEnergyConversionActive(actor)).toBe(false);
  });

  test("is not active outside of combat", async () => {
    global.game = { combat: { id: 'combat1', round: 1 } };
    const actor = makeActor();
    await activateBioEnergyConversion(actor);

    global.game.combat = null;
    expect(isBioEnergyConversionActive(actor)).toBe(false);
  });
});
