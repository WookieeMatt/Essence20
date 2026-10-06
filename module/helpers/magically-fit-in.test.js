import { jest } from '@jest/globals';
import { getMagicallyFitInBonus, magicallyFitInValue } from './magically-fit-in.mjs';

// Mystical Understanding's own Magically Fit In is a Use + RollModifier rule on the Perk (rules/conv12-slI12.test.js);
// what's left here is the flag Friendship Is Mystical writes on a friend, and its read in dice.mjs.

global.game = { i18n: { localize: (k) => k } };

function makeActor({ flagValue } = {}) {
  const flags = { magicallyFitInBonus: flagValue };
  return { getFlag: jest.fn((scope, key) => (scope == 'essence20' ? flags[key] : undefined)) };
}

describe("Magically Fit In's flag (Friendship Is Mystical) lasts for the rest of the scene", () => {
  const settings = { sceneClockScene: 4 };
  beforeEach(() => {
    settings.sceneClockScene = 4;
    global.game.settings = { get: jest.fn((scope, key) => settings[key]) };
  });
  afterAll(() => delete global.game.settings);

  test("reads the banked ranks on that Skill only, until the GM starts a new scene", () => {
    const actor = makeActor({ flagValue: magicallyFitInValue('athletics', 2) });
    expect(getMagicallyFitInBonus(actor, 'athletics')).toBe(2);
    expect(getMagicallyFitInBonus(actor, 'brawn')).toBe(0);
    settings.sceneClockScene = 5;
    expect(getMagicallyFitInBonus(actor, 'athletics')).toBe(0);
  });

  test("nothing banked, or a flag with no scene stamp, reads as 0", () => {
    expect(getMagicallyFitInBonus(makeActor(), 'athletics')).toBe(0);
    expect(getMagicallyFitInBonus(makeActor({ flagValue: { skill: 'athletics', amount: 2 } }), 'athletics')).toBe(0);
  });

  test("magicallyFitInValue stamps the current scene", () => {
    expect(magicallyFitInValue('brawn', 1)).toEqual({ skill: 'brawn', amount: 1, epoch: 4 });
  });
});
