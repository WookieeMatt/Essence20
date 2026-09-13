import { jest } from '@jest/globals';
import { activatePsychoAssault, isPsychoAssaultActive } from './psycho-assault.mjs';

function makeActor({ isMorphed = true, monsterForm = false, power = 1, usedThisTurn = null } = {}) {
  const flagStore = {};
  if (usedThisTurn) {
    flagStore.psychoAssaultActiveThisTurn = usedThisTurn;
  }
  if (monsterForm) {
    flagStore.monsterFormActive = true;
  }

  return {
    system: { isMorphed, powers: { personal: { value: power } } },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    update: jest.fn(),
  };
}

describe("isPsychoAssaultActive", () => {
  test("false with no stamp", () => {
    expect(isPsychoAssaultActive(makeActor())).toBe(false);
  });

  test("true when stamped with the current combat turn", () => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
    expect(isPsychoAssaultActive(makeActor({ usedThisTurn: { combatId: 'combat1', round: 1, turn: 0 } }))).toBe(true);
    game.combat = null;
  });

  test("false once the turn has moved on (a stale stamp)", () => {
    game.combat = { id: 'combat1', round: 1, turn: 1 };
    expect(isPsychoAssaultActive(makeActor({ usedThisTurn: { combatId: 'combat1', round: 1, turn: 0 } }))).toBe(false);
    game.combat = null;
  });
});

describe("activatePsychoAssault", () => {
  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
  });
  afterEach(() => {
    game.combat = null;
  });

  test("spends 1 Personal Power and stamps the current turn", async () => {
    const actor = makeActor({ isMorphed: true, monsterForm: false, power: 1 });
    const result = await activatePsychoAssault(actor);

    expect(result).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'psychoAssaultActiveThisTurn', { combatId: 'combat1', round: 1, turn: 0 },
    );
  });

  test("fails when not Morphed", async () => {
    const actor = makeActor({ isMorphed: false });
    const result = await activatePsychoAssault(actor);

    expect(result).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("fails while in Monster Form", async () => {
    const actor = makeActor({ isMorphed: true, monsterForm: true });
    const result = await activatePsychoAssault(actor);

    expect(result).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("fails when Personal Power can't cover the cost", async () => {
    const actor = makeActor({ isMorphed: true, power: 0 });
    const result = await activatePsychoAssault(actor);

    expect(result).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
  });
});
