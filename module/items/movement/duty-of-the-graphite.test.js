import { jest } from '@jest/globals';
import { activateDutyOfTheGraphite } from './duty-of-the-graphite.mjs';

describe("activateDutyOfTheGraphite", () => {
  test("rolls a Social Skill Test against Cleverness, flagged for post-hit processing", async () => {
    const actor = { _dice: { rollSkill: jest.fn() } };

    await activateDutyOfTheGraphite(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'persuasion', essence: 'social', defenseType: 'cleverness', isDutyOfTheGraphite: true }),
      actor,
    );
  });
});
