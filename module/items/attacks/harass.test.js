import { jest } from '@jest/globals';
import { activateHarass, canUseHarass, harassRollSources, isHarassActive } from './harass.mjs';

const combat = { id: 'combat1', round: 1, turn: 0, turns: [{ actor: { id: 'a' } }, { actor: { id: 'b' } }] };
global.game = { combat, settings: { get: () => 1 } };

function makeActor({ flag = undefined, flags = {} } = {}) {
  return {
    id: 'a',
    flags,
    getFlag: jest.fn((scope, key) => (key == 'harassUsedThisTurn' ? flag : flags[key])),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
  };
}

beforeEach(() => {
  game.combat = combat;
  combat.round = 1;
  combat.turn = 0;
});

describe("canUseHarass", () => {
  test("true with no prior use this turn", () => {
    expect(canUseHarass(makeActor())).toBe(true);
  });

  test("false once already used this turn", () => {
    const actor = makeActor({ flag: { combatId: 'combat1', round: 1, turn: 0 } });
    expect(canUseHarass(actor)).toBe(false);
  });

  test("true again next turn (stale record)", () => {
    const actor = makeActor({ flag: { combatId: 'combat1', round: 1, turn: 1 } });
    expect(canUseHarass(actor)).toBe(true);
  });
});

describe("activateHarass", () => {
  test("marks the turn used and lasts until the start of the actor's next turn", async () => {
    const actor = makeActor();

    await activateHarass(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'harassUsedThisTurn',
      expect.objectContaining({ combatId: 'combat1', round: 1, turn: 0 }));
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'harassActive',
      expect.objectContaining({ combatId: 'combat1', untilRound: 2, untilTurn: 0 }));
  });

  test("gives Edge on every Attack until then, not just the first", async () => {
    const actor = makeActor();
    await activateHarass(actor);
    const attack = { item: { type: 'weaponEffect' } };

    expect(harassRollSources(actor, null, attack).sources).toEqual([expect.objectContaining({ edge: true })]);
    expect(harassRollSources(actor, null, attack).sources).toHaveLength(1);
    combat.turn = 1;
    expect(isHarassActive(actor)).toBe(true);
    combat.round = 2;
    combat.turn = 0;
    expect(isHarassActive(actor)).toBe(false);
    expect(harassRollSources(actor, null, attack).sources).toHaveLength(0);
  });

  test("only applies to Attacks", async () => {
    const actor = makeActor();
    await activateHarass(actor);
    expect(harassRollSources(actor, null, { item: { type: 'skill' } }).sources).toHaveLength(0);
  });

  test("ends with the combat", async () => {
    const actor = makeActor();
    await activateHarass(actor);
    game.combat = null;
    expect(isHarassActive(actor)).toBe(false);
  });
});
