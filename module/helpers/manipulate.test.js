import { jest } from '@jest/globals';
import { activateManipulate } from './manipulate.mjs';

describe("activateManipulate", () => {
  test("rolls Persuasion vs Willpower, flagged as a Manipulate attempt", async () => {
    const actor = { _dice: { rollSkill: jest.fn() } };

    await activateManipulate(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'persuasion', essence: 'social', defenseType: 'willpower', isManipulateAttempt: true,
      }),
      actor,
    );
  });
});
