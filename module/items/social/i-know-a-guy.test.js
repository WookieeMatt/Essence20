import { jest } from '@jest/globals';
import { activateIKnowAGuyRoll } from './i-know-a-guy.mjs';

describe("activateIKnowAGuyRoll", () => {
  test("rolls Persuasion vs DIF 12", async () => {
    const actor = { _dice: { rollSkill: jest.fn() } };
    await activateIKnowAGuyRoll(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'persuasion', essence: 'social', dif: '12' }),
      actor,
    );
  });
});
