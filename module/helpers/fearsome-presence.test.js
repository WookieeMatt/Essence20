import { jest } from '@jest/globals';
import { activateFearsomePresence } from './fearsome-presence.mjs';

describe("activateFearsomePresence", () => {
  test("rolls Intimidation vs. Willpower, flagged for post-hit processing", async () => {
    const actor = { _dice: { rollSkill: jest.fn() } };

    await activateFearsomePresence(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'intimidation', essence: 'social', defenseType: 'willpower', isFearsomePresence: true,
      }),
      actor,
    );
  });
});
