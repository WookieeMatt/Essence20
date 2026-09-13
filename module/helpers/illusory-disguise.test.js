import { jest } from '@jest/globals';
import { activateIllusoryDisguise, activateIllusoryDisguiseRoll, isIllusoryDisguiseActive } from './illusory-disguise.mjs';

describe("activateIllusoryDisguiseRoll", () => {
  test("rolls Culture (Arcane) vs DIF 12 with the attempt flag set", async () => {
    const actor = { _dice: { rollSkill: jest.fn() } };
    await activateIllusoryDisguiseRoll(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'culture', essence: 'smarts', dif: '12', isIllusoryDisguiseAttempt: true }),
      actor,
    );
  });
});

describe("activateIllusoryDisguise / isIllusoryDisguiseActive", () => {
  test("false by default, true once activated", async () => {
    const flagStore = {};
    const actor = {
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
    };

    expect(isIllusoryDisguiseActive(actor)).toBe(false);
    await activateIllusoryDisguise(actor);
    expect(isIllusoryDisguiseActive(actor)).toBe(true);
  });
});
