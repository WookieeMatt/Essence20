import { jest } from '@jest/globals';
import { getRemaining } from './action-economy.mjs';
import { isWithinGetAGripSizeGate, spendGetAGripFreeActions } from './get-a-grip.mjs';

global.foundry = { utils: { randomID: jest.fn(() => 'gen1') } };

function makeActor({ size = 'common', free = 2 } = {}) {
  return {
    system: {
      size,
      actions: {
        enabled: true, shared: false,
        standard: { base: 1, bonus: 0, max: 1 },
        move: { base: 1, bonus: 0, max: 1 },
        free: { base: free, bonus: 0, max: free },
      },
    },
  };
}

function makeCombatant(actor) {
  const flags = {};
  return {
    actor,
    isOwner: true,
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
  };
}

describe("isWithinGetAGripSizeGate (Decepticon Directive p.58)", () => {
  test("allows a same-size target", () => {
    expect(isWithinGetAGripSizeGate(makeActor({ size: 'common' }), { system: { size: 'common' } })).toBe(true);
  });

  test("allows a target exactly one Size Class larger", () => {
    expect(isWithinGetAGripSizeGate(makeActor({ size: 'common' }), { system: { size: 'large' } })).toBe(true);
  });

  test("rejects a target more than one Size Class larger", () => {
    expect(isWithinGetAGripSizeGate(makeActor({ size: 'common' }), { system: { size: 'long' } })).toBe(false);
  });

  test("allows a smaller target", () => {
    expect(isWithinGetAGripSizeGate(makeActor({ size: 'large' }), { system: { size: 'small' } })).toBe(true);
  });

  test("rejects an unrecognized size", () => {
    expect(isWithinGetAGripSizeGate(makeActor({ size: 'common' }), { system: { size: 'nonsense' } })).toBe(false);
  });
});

describe("spendGetAGripFreeActions (Decepticon Directive p.58)", () => {
  beforeEach(() => {
    // 'strict' mode + a non-GM user - action-economy.mjs's own isBlocking() only enforces
    // affordability under 'strict', and always bypasses for a GM (see its own doc comment), so
    // the default test env (which reports an unrecognized mode, falling back to 'track') would
    // let every spend through regardless of the actor's remaining budget.
    global.game = {
      i18n: { localize: (k) => k, format: (k) => k },
      user: { isGM: false },
      settings: { get: jest.fn(() => 'strict') },
    };
  });

  test("spends both Free actions when 2 are available", async () => {
    const actor = makeActor({ free: 2 });
    const combatant = makeCombatant(actor);
    game.combat = { id: 'combat1', getCombatantsByActor: jest.fn(() => [combatant]) };

    const result = await spendGetAGripFreeActions(actor, 'Get A Grip');

    expect(result).toBe(true);
    expect(getRemaining(actor).free).toBe(0);
  });

  test("refunds the first spend and fails when only 1 Free action is available", async () => {
    const actor = makeActor({ free: 1 });
    const combatant = makeCombatant(actor);
    game.combat = { id: 'combat1', getCombatantsByActor: jest.fn(() => [combatant]) };

    const result = await spendGetAGripFreeActions(actor, 'Get A Grip');

    expect(result).toBe(false);
    expect(getRemaining(actor).free).toBe(1);
  });

  test("fails immediately with no Free actions available", async () => {
    const actor = makeActor({ free: 0 });
    const combatant = makeCombatant(actor);
    game.combat = { id: 'combat1', getCombatantsByActor: jest.fn(() => [combatant]) };

    const result = await spendGetAGripFreeActions(actor, 'Get A Grip');

    expect(result).toBe(false);
    expect(getRemaining(actor).free).toBe(0);
  });
});
