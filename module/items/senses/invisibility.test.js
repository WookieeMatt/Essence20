import { jest } from '@jest/globals';
import {
  canUseInvisibility, deactivateInvisibilityOnAttack, deactivateInvisibilityOnLendAssistance,
  isInvisibilityActive, toggleInvisibility,
} from './invisibility.mjs';

global.game = { combat: null };

function makeActor({ active = false, usedFlag = undefined } = {}) {
  const flagStore = { invisibilityActive: active, invisibilityUsedThisEncounter: usedFlag };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    toggleStatusEffect: jest.fn(),
  };
}

beforeEach(() => {
  game.combat = { id: 'combat1', round: 1, turn: 0 };
});

afterEach(() => {
  game.combat = null;
});

describe("canUseInvisibility", () => {
  test("true, not yet used this scene", () => {
    expect(canUseInvisibility(makeActor())).toBe(true);
  });

  test("false once already used this scene, unless already active", () => {
    const actor = makeActor({ usedFlag: { epoch: 1, window: 'encounter', count: 1 } });
    expect(canUseInvisibility(actor)).toBe(false);

    const activeActor = makeActor({ active: true, usedFlag: { epoch: 1, window: 'encounter', count: 1 } });
    expect(canUseInvisibility(activeActor)).toBe(true);
  });
});

describe("isInvisibilityActive", () => {
  test("reflects the actor's own flag", () => {
    expect(isInvisibilityActive(makeActor({ active: true }))).toBe(true);
    expect(isInvisibilityActive(makeActor({ active: false }))).toBe(false);
  });
});

describe("toggleInvisibility", () => {
  test("switches on, applies the status, and marks the scene used", async () => {
    const actor = makeActor({ active: false });

    const result = await toggleInvisibility(actor);

    expect(result).toBe(true);
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('invisible', { active: true });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'invisibilityUsedThisEncounter', expect.objectContaining({ epoch: 1, window: 'encounter', count: 1 }),
    );
  });

  test("switches off freely, even without a scene use remaining", async () => {
    const actor = makeActor({ active: true, usedFlag: { epoch: 1, window: 'encounter', count: 1 } });

    const result = await toggleInvisibility(actor);

    expect(result).toBe(false);
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('invisible', { active: false });
  });

  test("can't switch on again once already used this scene", async () => {
    const actor = makeActor({ active: false, usedFlag: { epoch: 1, window: 'encounter', count: 1 } });

    const result = await toggleInvisibility(actor);

    expect(result).toBe(false);
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });
});

describe("deactivateInvisibilityOnAttack", () => {
  test("clears an active Invisibility", async () => {
    const actor = makeActor({ active: true });

    await deactivateInvisibilityOnAttack(actor);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('invisible', { active: false });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'invisibilityActive', false);
  });

  test("does nothing while already inactive", async () => {
    const actor = makeActor({ active: false });

    await deactivateInvisibilityOnAttack(actor);

    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("deactivateInvisibilityOnLendAssistance", () => {
  test("clears an active Invisibility", async () => {
    const actor = makeActor({ active: true });

    await deactivateInvisibilityOnLendAssistance(actor);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('invisible', { active: false });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'invisibilityActive', false);
  });

  test("does nothing while already inactive", async () => {
    const actor = makeActor({ active: false });

    await deactivateInvisibilityOnLendAssistance(actor);

    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
