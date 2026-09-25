import { jest } from '@jest/globals';
import { activateOnTarget, canUseOnTarget } from './on-target.mjs';

describe("On Target (MLP CRB, Influence Perk, p.46)", () => {
  test("canUseOnTarget is true until used this round", () => {
    global.game = { combat: null };
    const actor = { getFlag: jest.fn(() => undefined) };
    expect(canUseOnTarget(actor)).toBe(true);
  });

  test("canUseOnTarget is false once already used this round", () => {
    global.game = { combat: { id: 'c1', round: 2 } };
    const actor = { getFlag: jest.fn(() => ({ combatId: 'c1', round: 2 })) };
    expect(canUseOnTarget(actor)).toBe(false);
  });

  test("activateOnTarget marks the round used and rolls Targeting", async () => {
    global.game = { combat: { id: 'c1', round: 1 } };
    const actor = {
      setFlag: jest.fn(),
      _dice: { rollSkill: jest.fn() },
    };

    await activateOnTarget(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'onTargetUsedThisRound', expect.any(Object));
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'targeting' }), actor,
    );
  });
});
