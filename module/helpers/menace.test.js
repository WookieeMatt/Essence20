import { jest } from '@jest/globals';
import { activateMenace, canUseMenace } from './menace.mjs';

global.game = { scenes: { current: { id: 'scene1' } } };

function makeActor({ originSkill = 'brawn', usesThisScene = null } = {}) {
  return {
    system: { originSkillsIncrease: originSkill },
    getFlag: jest.fn(() => usesThisScene),
    setFlag: jest.fn(),
    _dice: { rollSkill: jest.fn() },
  };
}

describe("canUseMenace", () => {
  test("true when never used this scene", () => {
    const actor = makeActor();
    expect(canUseMenace(actor)).toBe(true);
  });

  test("false once already used this scene", () => {
    const actor = makeActor({ usesThisScene: { sceneId: 'scene1', count: 1 } });
    expect(canUseMenace(actor)).toBe(false);
  });

  test("true again in a different scene (stale record)", () => {
    const actor = makeActor({ usesThisScene: { sceneId: 'scene0', count: 1 } });
    expect(canUseMenace(actor)).toBe(true);
  });
});

describe("activateMenace", () => {
  test("rolls the actor's own Origin skill against Willpower", async () => {
    const actor = makeActor({ originSkill: 'brawn' });

    await activateMenace(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'brawn',
        essence: 'strength',
        defenseType: 'willpower',
        isMenace: true,
      }),
      actor,
    );
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'menaceUsesThisScene',
      expect.objectContaining({ count: 1 }));
  });

  test("does nothing without an Origin skill", async () => {
    const actor = makeActor({ originSkill: null });

    await activateMenace(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
