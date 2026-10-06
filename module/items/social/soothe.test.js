import { jest } from '@jest/globals';
import { activateSoothe } from './soothe.mjs';

describe("activateSoothe", () => {
  test("rolls an Animal Handling Skill Test against Willpower, flagged for post-hit processing", async () => {
    const actor = { _dice: { rollSkill: jest.fn() } };

    await activateSoothe(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'animalHandling', essence: 'social', defenseType: 'willpower', isSoothe: true }),
      actor,
    );
  });
});
