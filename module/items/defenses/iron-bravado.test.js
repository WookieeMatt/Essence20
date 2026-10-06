import { jest } from '@jest/globals';
import { isIronBravadoFrightenedImmune, markIronBravadoAttack } from './iron-bravado.mjs';

global.game = { combat: null };

function makeActor() {
  return { getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
}

describe("markIronBravadoAttack", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("stamps the current combat's id and the following round", async () => {
    game.combat = { id: 'combat1', round: 3 };
    const actor = makeActor();
    await markIronBravadoAttack(actor);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'ironBravadoAttackedThisRound', {
      combatId: 'combat1', expiresRound: 4,
    });
  });

  test("stamps a null combatId outside of combat", async () => {
    const actor = makeActor();
    await markIronBravadoAttack(actor);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'ironBravadoAttackedThisRound', {
      combatId: null, expiresRound: 1,
    });
  });
});

describe("isIronBravadoFrightenedImmune", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("false with no stamped flag at all", () => {
    expect(isIronBravadoFrightenedImmune(makeActor())).toBe(false);
  });

  test("true for the same combat, at or before the expiration round", () => {
    game.combat = { id: 'combat1', round: 4 };
    const actor = { getFlag: jest.fn(() => ({ combatId: 'combat1', expiresRound: 4 })) };
    expect(isIronBravadoFrightenedImmune(actor)).toBe(true);
  });

  test("false once the current round passes the expiration round", () => {
    game.combat = { id: 'combat1', round: 5 };
    const actor = { getFlag: jest.fn(() => ({ combatId: 'combat1', expiresRound: 4 })) };
    expect(isIronBravadoFrightenedImmune(actor)).toBe(false);
  });

  test("false for a stale flag from a different combat", () => {
    game.combat = { id: 'combat2', round: 1 };
    const actor = { getFlag: jest.fn(() => ({ combatId: 'combat1', expiresRound: 4 })) };
    expect(isIronBravadoFrightenedImmune(actor)).toBe(false);
  });

  test("true outside of combat whenever a flag is stamped at all", () => {
    const actor = { getFlag: jest.fn(() => ({ combatId: null, expiresRound: 0 })) };
    expect(isIronBravadoFrightenedImmune(actor)).toBe(true);
  });
});
