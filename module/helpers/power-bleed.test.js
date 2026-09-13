import { jest } from '@jest/globals';
import { activatePowerBleed, drainPowerBleedTarget, isPowerBleedActive } from './power-bleed.mjs';

function makeActor({ power = 1, usedThisTurn = null } = {}) {
  const flagStore = {};
  if (usedThisTurn) {
    flagStore.powerBleedActiveThisTurn = usedThisTurn;
  }

  return {
    system: { powers: { personal: { value: power } } },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    update: jest.fn(),
  };
}

describe("isPowerBleedActive", () => {
  test("false with no stamp", () => {
    expect(isPowerBleedActive(makeActor())).toBe(false);
  });

  test("true when stamped with the current combat turn", () => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
    expect(isPowerBleedActive(makeActor({ usedThisTurn: { combatId: 'combat1', round: 1, turn: 0 } }))).toBe(true);
    game.combat = null;
  });

  test("false once the turn has moved on", () => {
    game.combat = { id: 'combat1', round: 1, turn: 1 };
    expect(isPowerBleedActive(makeActor({ usedThisTurn: { combatId: 'combat1', round: 1, turn: 0 } }))).toBe(false);
    game.combat = null;
  });
});

describe("activatePowerBleed", () => {
  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
  });
  afterEach(() => {
    game.combat = null;
  });

  test("spends 1 Personal Power and stamps the current turn", async () => {
    const actor = makeActor({ power: 1 });
    const result = await activatePowerBleed(actor);

    expect(result).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'powerBleedActiveThisTurn', { combatId: 'combat1', round: 1, turn: 0 },
    );
  });

  test("fails when Personal Power can't cover the cost", async () => {
    const actor = makeActor({ power: 0 });
    const result = await activatePowerBleed(actor);

    expect(result).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("drainPowerBleedTarget", () => {
  test("docks 1 Personal Power", async () => {
    const targetActor = { system: { powers: { personal: { value: 2 } } }, update: jest.fn() };
    await drainPowerBleedTarget(targetActor);
    expect(targetActor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 1 });
  });

  test("floors at 0", async () => {
    const targetActor = { system: { powers: { personal: { value: 0 } } }, update: jest.fn() };
    await drainPowerBleedTarget(targetActor);
    expect(targetActor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
  });

  test("no-ops for a target with no Personal Power pool at all", async () => {
    const targetActor = { system: { powers: {} }, update: jest.fn() };
    await drainPowerBleedTarget(targetActor);
    expect(targetActor.update).not.toHaveBeenCalled();
  });
});
