import { jest } from '@jest/globals';
import { getRemaining } from './action-economy.mjs';
import { applyVainglorious } from './vainglorious.mjs';

const VAINGLORIOUS_ID = "Compendium.essence20.tf_crb.Item.ztsvCKdnaDZzBR8Q";

global.foundry = { utils: { randomID: jest.fn(() => 'gen1') } };

function makeActor({ hasHangUp = true, flags = {} } = {}) {
  const flagStore = { ...flags };
  return {
    system: {
      actions: {
        enabled: true, shared: false,
        standard: { base: 1, bonus: 0, max: 1 },
        move: { base: 1, bonus: 0, max: 1 },
        free: { base: 0, bonus: 0, max: 0 },
      },
    },
    items: hasHangUp
      ? [{ type: 'hangUp', flags: { core: { sourceId: VAINGLORIOUS_ID } } }]
      : [],
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
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

describe("applyVainglorious (Transformers CRB p.43)", () => {
  beforeEach(() => {
    global.game = {
      i18n: { localize: (k) => k, format: (k) => k },
      user: { isGM: true },
    };
  });

  test("forces a Standard-action spend on the actor's first turn of the combat", async () => {
    const actor = makeActor();
    const combatant = makeCombatant(actor);
    game.combat = { id: 'combat1', getCombatantsByActor: jest.fn(() => [combatant]) };

    await applyVainglorious(actor);

    expect(getRemaining(actor).standard).toBe(0);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'vainglorAlreadyActedThisCombat', 'combat1');
  });

  test("does nothing on a later turn of the same combat (already spent it)", async () => {
    const actor = makeActor({ flags: { vainglorAlreadyActedThisCombat: 'combat1' } });
    const combatant = makeCombatant(actor);
    game.combat = { id: 'combat1', getCombatantsByActor: jest.fn(() => [combatant]) };

    await applyVainglorious(actor);

    expect(getRemaining(actor).standard).toBe(1);
  });

  test("triggers again in a NEW combat, since it's tracked per-combat, not once ever", async () => {
    const actor = makeActor({ flags: { vainglorAlreadyActedThisCombat: 'oldCombat' } });
    const combatant = makeCombatant(actor);
    game.combat = { id: 'newCombat', getCombatantsByActor: jest.fn(() => [combatant]) };

    await applyVainglorious(actor);

    expect(getRemaining(actor).standard).toBe(0);
  });

  test("does nothing for an actor without the Hang-Up", async () => {
    const actor = makeActor({ hasHangUp: false });
    const combatant = makeCombatant(actor);
    game.combat = { id: 'combat1', getCombatantsByActor: jest.fn(() => [combatant]) };

    await applyVainglorious(actor);

    expect(getRemaining(actor).standard).toBe(1);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("does nothing outside combat", async () => {
    game.combat = null;
    const actor = makeActor();

    await applyVainglorious(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
