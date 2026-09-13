import { jest } from '@jest/globals';
import { activateNemesisDrain, applyNemesisDrainEffect, getNemesisDrainPenalty } from './nemesis-drain.mjs';

global.canvas = {
  tokens: { placeables: [], setTargets: jest.fn() },
  grid: { measurePath: jest.fn(() => ({ distance: 5 })) },
};

function makeToken({ id, disposition = -1 } = {}) {
  return { id, actor: { id: `actor-${id}` }, document: { disposition }, center: {} };
}

describe("activateNemesisDrain", () => {
  beforeEach(() => {
    canvas.tokens.setTargets.mockReset();
    canvas.tokens.placeables = [];
  });

  test("targets every nearby enemy and rolls Intimidation vs. Willpower", async () => {
    const selfToken = makeToken({ id: 'self', disposition: 1 });
    const enemy1 = makeToken({ id: 'e1', disposition: -1 });
    canvas.tokens.placeables = [selfToken, enemy1];

    const actor = {
      getActiveTokens: jest.fn(() => [selfToken]),
      _dice: { rollSkill: jest.fn() },
    };

    await activateNemesisDrain(actor);

    expect(canvas.tokens.setTargets).toHaveBeenCalledWith(['e1']);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'intimidation', essence: 'social', defenseType: 'willpower', isNemesisDrain: true }),
      actor,
    );
  });
});

describe("applyNemesisDrainEffect", () => {
  test("docks 1 Personal Power and marks the penalty active", async () => {
    const targetActor = {
      system: { powers: { personal: { value: 2 } } },
      update: jest.fn(),
      setFlag: jest.fn(),
    };

    await applyNemesisDrainEffect(targetActor);

    expect(targetActor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 1 });
    expect(targetActor.setFlag).toHaveBeenCalledWith('essence20', 'nemesisDrainPenaltyActive', true);
  });

  test("floors Personal Power at 0", async () => {
    const targetActor = {
      system: { powers: { personal: { value: 0 } } },
      update: jest.fn(),
      setFlag: jest.fn(),
    };

    await applyNemesisDrainEffect(targetActor);

    expect(targetActor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
  });

  test("skips the Power update entirely for a target with no Personal Power pool", async () => {
    const targetActor = { system: { powers: {} }, update: jest.fn(), setFlag: jest.fn() };

    await applyNemesisDrainEffect(targetActor);

    expect(targetActor.update).not.toHaveBeenCalled();
    expect(targetActor.setFlag).toHaveBeenCalledWith('essence20', 'nemesisDrainPenaltyActive', true);
  });
});

describe("getNemesisDrainPenalty", () => {
  function makeActor({ isMorphed = true, penaltyActive = true } = {}) {
    return {
      system: { isMorphed },
      getFlag: jest.fn((scope, key) => (key == 'nemesisDrainPenaltyActive' ? penaltyActive : undefined)),
    };
  }

  test("-1 while Morphed with the penalty active", () => {
    expect(getNemesisDrainPenalty(makeActor({ isMorphed: true, penaltyActive: true }))).toBe(-1);
  });

  test("0 without the penalty flag", () => {
    expect(getNemesisDrainPenalty(makeActor({ isMorphed: true, penaltyActive: false }))).toBe(0);
  });

  test("0 while not Morphed, even with the flag set", () => {
    expect(getNemesisDrainPenalty(makeActor({ isMorphed: false, penaltyActive: true }))).toBe(0);
  });
});
