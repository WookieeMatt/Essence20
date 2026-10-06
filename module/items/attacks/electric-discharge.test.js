import { jest } from '@jest/globals';
import { activateElectricDischarge } from './electric-discharge.mjs';

describe("activateElectricDischarge", () => {
  test("rolls a Targeting Attack with the synthetic damage flag set", async () => {
    const actor = { _dice: { rollSkill: jest.fn() } };
    await activateElectricDischarge(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'targeting', essence: 'speed', shiftUp: 1, defenseType: 'evasion', isElectricDischarge: true,
      }),
      actor,
    );
  });
});
