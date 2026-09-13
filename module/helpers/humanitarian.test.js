import { jest } from '@jest/globals';
import { activateHumanitarianRoll } from './humanitarian.mjs';

describe("activateHumanitarianRoll", () => {
  test("rolls Survival vs DIF 12 with the attempt flag set", async () => {
    const actor = { _dice: { rollSkill: jest.fn() } };
    await activateHumanitarianRoll(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'survival', essence: 'smarts', dif: '12', isHumanitarianAttempt: true }),
      actor,
    );
  });
});
