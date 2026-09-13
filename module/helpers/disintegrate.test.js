import { jest } from '@jest/globals';
import { activateDisintegrate } from './disintegrate.mjs';

global.game = { user: { targets: { first: () => undefined } } };

describe("activateDisintegrate", () => {
  afterEach(() => {
    global.game.user.targets = { first: () => undefined };
  });

  test("rolls a Targeting Attack against a vehicle target with the synthetic damage flag set", async () => {
    const actor = { _dice: { rollSkill: jest.fn() } };
    const targetActor = { type: 'vehicle' };
    global.game.user.targets = { first: () => ({ actor: targetActor }) };

    const result = await activateDisintegrate(actor);

    expect(result).toBe(true);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'targeting', essence: 'speed', defenseType: 'toughness', isDisintegrate: true,
      }),
      actor,
    );
  });

  test("returns false and rolls nothing against a non-vehicle target", async () => {
    const actor = { _dice: { rollSkill: jest.fn() } };
    const targetActor = { type: 'playerCharacter' };
    global.game.user.targets = { first: () => ({ actor: targetActor }) };

    const result = await activateDisintegrate(actor);

    expect(result).toBe(false);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("returns false and rolls nothing without a target", async () => {
    const actor = { _dice: { rollSkill: jest.fn() } };

    const result = await activateDisintegrate(actor);

    expect(result).toBe(false);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});
