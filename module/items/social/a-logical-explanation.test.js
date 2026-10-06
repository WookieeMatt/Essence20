import { jest } from '@jest/globals';
import { activateALogicalExplanation } from './a-logical-explanation.mjs';

describe("activateALogicalExplanation", () => {
  test("rolls a Science Skill Test against Willpower, flagged for post-hit processing", async () => {
    const actor = { _dice: { rollSkill: jest.fn() } };

    await activateALogicalExplanation(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'science', essence: 'smarts', defenseType: 'willpower', isALogicalExplanation: true }),
      actor,
    );
  });
});
