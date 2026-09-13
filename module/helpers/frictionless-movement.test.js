import { jest } from '@jest/globals';
import {
  activateFrictionlessMovement, canUseFrictionlessMovement, deactivateFrictionlessMovementAtTurnEnd,
  isFrictionlessMovementActive,
} from './frictionless-movement.mjs';

global.game = { combat: null };

function makeActor({ active = false, usedFlag = undefined } = {}) {
  const flagStore = { frictionlessMovementActive: active, frictionlessMovementUsedThisEncounter: usedFlag };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

beforeEach(() => {
  game.combat = { id: 'combat1', round: 1, turn: 0 };
});

afterEach(() => {
  game.combat = null;
});

describe("canUseFrictionlessMovement", () => {
  test("true, not yet used this scene", () => {
    expect(canUseFrictionlessMovement(makeActor())).toBe(true);
  });

  test("false once already used this scene", () => {
    const actor = makeActor({ usedFlag: { combatId: 'combat1' } });
    expect(canUseFrictionlessMovement(actor)).toBe(false);
  });
});

describe("isFrictionlessMovementActive", () => {
  test("false by default", () => {
    expect(isFrictionlessMovementActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isFrictionlessMovementActive(makeActor({ active: true }))).toBe(true);
  });
});

describe("activateFrictionlessMovement", () => {
  test("sets the active flag and marks the scene used", async () => {
    const actor = makeActor();

    await activateFrictionlessMovement(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'frictionlessMovementActive', true);
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'frictionlessMovementUsedThisEncounter', expect.objectContaining({ combatId: 'combat1' }),
    );
    expect(isFrictionlessMovementActive(actor)).toBe(true);
  });
});

describe("deactivateFrictionlessMovementAtTurnEnd", () => {
  test("clears the flag when active", async () => {
    const actor = makeActor({ active: true });
    await deactivateFrictionlessMovementAtTurnEnd(actor);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'frictionlessMovementActive', false);
  });

  test("does nothing when already inactive", async () => {
    const actor = makeActor({ active: false });
    await deactivateFrictionlessMovementAtTurnEnd(actor);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
