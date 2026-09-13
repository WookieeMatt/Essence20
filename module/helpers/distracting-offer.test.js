import { jest } from '@jest/globals';
import { activateDistractingOffer, canUseDistractingOffer, recordDistractingOfferResult } from './distracting-offer.mjs';

global.game = {
  scenes: { current: { id: 'scene1' } },
  user: { targets: { first: jest.fn() } },
  combat: null,
};
global.ui = { notifications: { warn: jest.fn() } };
global.i18n = {};
game.i18n = { localize: (k) => k, format: (k) => k };

function makeActor({ originSkill = 'deception', state = null } = {}) {
  return {
    system: { originSkillsIncrease: originSkill },
    getFlag: jest.fn(() => state),
    setFlag: jest.fn(),
    _dice: { rollSkill: jest.fn() },
  };
}

function makeTargetActor(uuid = 'Actor.target1') {
  return { uuid };
}

beforeEach(() => {
  ui.notifications.warn.mockReset();
  game.user.targets.first.mockReset();
});

describe("canUseDistractingOffer", () => {
  test("true with no prior state this scene", () => {
    const actor = makeActor();
    expect(canUseDistractingOffer(actor, makeTargetActor())).toBe(true);
  });

  test("false once a prior attempt this scene failed", () => {
    const actor = makeActor({ state: { sceneId: 'scene1', failed: true } });
    expect(canUseDistractingOffer(actor, makeTargetActor())).toBe(false);
  });

  test("true again against the same target after a success", () => {
    const actor = makeActor({
      state: { sceneId: 'scene1', failed: false, succeededTargetUuid: 'Actor.target1' },
    });
    expect(canUseDistractingOffer(actor, makeTargetActor('Actor.target1'))).toBe(true);
  });

  test("false against a DIFFERENT target after a success", () => {
    const actor = makeActor({
      state: { sceneId: 'scene1', failed: false, succeededTargetUuid: 'Actor.target1' },
    });
    expect(canUseDistractingOffer(actor, makeTargetActor('Actor.other'))).toBe(false);
  });

  test("true again in a different scene (stale record)", () => {
    const actor = makeActor({ state: { sceneId: 'scene0', failed: true } });
    expect(canUseDistractingOffer(actor, makeTargetActor())).toBe(true);
  });
});

describe("activateDistractingOffer", () => {
  test("warns and does not roll with no target", async () => {
    game.user.targets.first.mockReturnValue(undefined);
    const actor = makeActor();

    await activateDistractingOffer(actor);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("warns and does not roll when unavailable against this target", async () => {
    game.user.targets.first.mockReturnValue({ actor: makeTargetActor('Actor.other') });
    const actor = makeActor({
      state: { sceneId: 'scene1', failed: false, succeededTargetUuid: 'Actor.target1' },
    });

    await activateDistractingOffer(actor);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("rolls the actor's own Origin skill against Cleverness", async () => {
    game.user.targets.first.mockReturnValue({ actor: makeTargetActor('Actor.target1') });
    const actor = makeActor({ originSkill: 'deception' });

    await activateDistractingOffer(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'deception',
        essence: 'social',
        defenseType: 'cleverness',
        isDistractingOffer: true,
      }),
      actor,
    );
  });
});

describe("recordDistractingOfferResult", () => {
  test("records a failure", async () => {
    const actor = makeActor();
    const targetActor = makeTargetActor();

    await recordDistractingOfferResult(actor, targetActor, false, false);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'distractingOfferState',
      expect.objectContaining({ failed: true }));
  });

  test("records a success and banks a shiftDown of 1 on the target", async () => {
    const actor = makeActor();
    const targetActor = makeTargetActor('Actor.target1');
    targetActor.setFlag = jest.fn();

    await recordDistractingOfferResult(actor, targetActor, true, false);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'distractingOfferState',
      expect.objectContaining({ failed: false, succeededTargetUuid: 'Actor.target1' }));
    expect(targetActor.setFlag).toHaveBeenCalledWith('essence20', 'pendingDistractingOfferShiftDown',
      expect.objectContaining({ amount: 1 }));
  });

  test("doubles the shiftDown to 2 on a Critical Success", async () => {
    const actor = makeActor();
    const targetActor = makeTargetActor('Actor.target1');
    targetActor.setFlag = jest.fn();

    await recordDistractingOfferResult(actor, targetActor, true, true);

    expect(targetActor.setFlag).toHaveBeenCalledWith('essence20', 'pendingDistractingOfferShiftDown',
      expect.objectContaining({ amount: 2 }));
  });
});
