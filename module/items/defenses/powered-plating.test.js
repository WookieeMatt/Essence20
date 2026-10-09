import { jest } from '@jest/globals';
import {
  clearPoweredPlating, getPoweredPlatingBonus,
} from './powered-plating.mjs';

global.game = { i18n: { localize: (k) => k } };
global.foundry = { data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor({ power = 4, isMorphed = true, bonus = undefined } = {}) {
  return {
    system: { powers: { personal: { value: power } }, isMorphed },
    update: jest.fn(),
    setFlag: jest.fn(),
    unsetFlag: jest.fn(),
    getFlag: jest.fn(() => bonus),
  };
}

describe("getPoweredPlatingBonus", () => {
  test("returns the banked amount while Morphed", () => {
    const actor = makeActor({ isMorphed: true, bonus: 3 });
    expect(getPoweredPlatingBonus(actor)).toBe(3);
  });

  test("returns 0 while not Morphed, even with a stale banked amount", () => {
    const actor = makeActor({ isMorphed: false, bonus: 3 });
    expect(getPoweredPlatingBonus(actor)).toBe(0);
  });

  test("returns 0 with nothing banked", () => {
    const actor = makeActor({ isMorphed: true, bonus: undefined });
    expect(getPoweredPlatingBonus(actor)).toBe(0);
  });
});

describe("clearPoweredPlating", () => {
  test("unsets the flag", async () => {
    const actor = makeActor();
    await clearPoweredPlating(actor);
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'poweredPlatingBonus');
  });
});
