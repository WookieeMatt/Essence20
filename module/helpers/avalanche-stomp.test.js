import { jest } from '@jest/globals';
import { activateAvalancheStomp, applyAvalancheStompEffect } from './avalanche-stomp.mjs';

// Only the no-token-on-scene bail-out is unit-tested for activateAvalancheStomp - the actual catch
// (getTokensInShape, a real canvas.tokens.placeables scan) is live-canvas code with no meaningful
// Jest stand-in, same as Mighty Strikes' own mighty-strikes.test.js doc comment.

describe("activateAvalancheStomp", () => {
  test("does nothing without an active token on the scene", async () => {
    const actor = {
      getActiveTokens: jest.fn(() => []),
      _dice: { rollSkill: jest.fn() },
    };

    await expect(activateAvalancheStomp(actor)).resolves.toEqual([]);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("applyAvalancheStompEffect", () => {
  test("Stuns on a plain success", async () => {
    const targetActor = { toggleStatusEffect: jest.fn() };
    await applyAvalancheStompEffect(targetActor, false);
    expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('stunned', { active: true });
    expect(targetActor.toggleStatusEffect).not.toHaveBeenCalledWith('prone', { active: true });
  });

  test("also knocks Prone on a Critical Success", async () => {
    const targetActor = { toggleStatusEffect: jest.fn() };
    await applyAvalancheStompEffect(targetActor, true);
    expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('stunned', { active: true });
    expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('prone', { active: true });
  });
});
