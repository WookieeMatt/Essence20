import { jest } from '@jest/globals';
import { activatePowerBlast } from './power-blast.mjs';

function makeActor() {
  return { _dice: { rollSkill: jest.fn() } };
}

describe("activatePowerBlast", () => {
  test("triggers a real Athletics-vs-Evasion roll with the spent amount as the synthetic damage", async () => {
    const actor = makeActor();

    await activatePowerBlast(actor, 4);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'athletics', essence: 'strength', defenseType: 'evasion', isPowerBlast: true, powerBlastAmount: 4,
      }),
      actor,
    );
  });

  test("does nothing when nothing was spent", async () => {
    const actor = makeActor();

    await activatePowerBlast(actor, 0);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});
