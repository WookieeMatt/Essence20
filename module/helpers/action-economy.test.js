import { jest } from '@jest/globals';
import {
  adjust,
  canSpend,
  consumeForItem,
  describeCost,
  getBudget,
  getActionsTabContext,
  getCombatant,
  getCost,
  getLedger,
  getMode,
  getRemaining,
  getSheetContext,
  isAiming,
  isBlocking,
  isTracking,
  refund,
  resetTurn,
  setAiming,
  spend,
  tradeStandardForFree,
} from './action-economy.mjs';

let idCounter = 0;

global.foundry = {
  utils: {
    randomID: jest.fn(() => `id${++idCounter}`),
  },
};

/**
 * A combatant carrying its own flag store, standing in for the real document.
 */
function makeCombatant({ actor = null, tokenId = 'token1', isOwner = true, group = null } = {}) {
  const flags = {};
  return {
    actor,
    tokenId,
    isOwner,
    group,
    uuid: `Combat.c1.Combatant.${tokenId}`,
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flags[key];
    }),
  };
}

function makeActor({
  enabled = true, standard = 1, move = 1, free = 0, shared = false, name = "Duke", items = [],
} = {}) {
  return {
    name,
    items,
    token: { id: "token1" },
    system: {
      actions: {
        enabled,
        shared,
        standard: { base: 1, bonus: 0, max: standard },
        move: { base: 1, bonus: 0, max: move },
        free: { base: 0, bonus: 0, max: free },
      },
    },
  };
}

/**
 * Wires up global.game with an active combat containing the given combatant.
 */
function setGame({ combatant = null, mode = 'track', isGM = false } = {}) {
  global.game = {
    user: { isGM, isActiveGM: isGM },
    i18n: { localize: jest.fn(key => key), format: jest.fn(key => key) },
    settings: {
      get: jest.fn((scope, key) => {
        if (key == 'actionEconomyMode') return mode;
        return undefined;
      }),
    },
    combat: combatant
      ? { combatants: [combatant], getCombatantsByActor: jest.fn(() => [combatant]) }
      : null,
    socket: { emit: jest.fn() },
  };
}

beforeEach(() => {
  idCounter = 0;
  setGame();
});

describe("getMode / isTracking / isBlocking", () => {
  test("defaults to track when the setting isn't registered", () => {
    global.game.settings.get = jest.fn(() => undefined);
    expect(getMode()).toBe('track');
    expect(isTracking()).toBe(true);
  });

  test("respects a registered mode", () => {
    setGame({ mode: 'off' });
    expect(getMode()).toBe('off');
    expect(isTracking()).toBe(false);
  });

  test("only strict blocks, and never for a GM", () => {
    setGame({ mode: 'strict' });
    expect(isBlocking()).toBe(true);

    setGame({ mode: 'strict', isGM: true });
    expect(isBlocking()).toBe(false);

    setGame({ mode: 'warn' });
    expect(isBlocking()).toBe(false);
  });
});

describe("getCombatant", () => {
  test("returns null with no combat", () => {
    expect(getCombatant(makeActor())).toBeNull();
  });

  test("prefers the combatant matching the actor's own token", () => {
    const other = makeCombatant({ tokenId: 'tokenOther' });
    const mine = makeCombatant({ tokenId: 'token1' });
    setGame({ combatant: mine });
    global.game.combat.getCombatantsByActor = jest.fn(() => [other, mine]);
    expect(getCombatant(makeActor())).toBe(mine);
  });

});

describe("getBudget / getRemaining", () => {
  test("reads the derived max, preserving null as unlimited", () => {
    expect(getBudget(makeActor())).toEqual({ standard: 1, move: 1, free: 0 });
  });

  test("an actor with no actions block reports nulls rather than throwing", () => {
    expect(getBudget({ system: {} })).toEqual({
      standard: 0, move: 0, free: 0,
    });
  });

  test("subtracts what the ledger has spent, and leaves unlimited alone", async () => {
    const combatant = makeCombatant();
    setGame({ combatant });
    const actor = makeActor();

    await spend(actor, 'standard');
    await spend(actor, 'free');

    expect(getRemaining(actor)).toEqual({ standard: 0, move: 1, free: 0 });
  });
});

describe("getCost", () => {
  test("maps each action type to its categories", () => {
    expect(getCost('standard')).toEqual({ standard: 1 });
    expect(getCost('fullAction')).toEqual({ standard: 1, move: 1 });
    expect(getCost('contingency')).toEqual({ standard: 1 });
  });

  test("passive and out-of-combat duration types cost nothing", () => {
    expect(getCost('none')).toEqual({});
    expect(getCost('tenMinutes')).toEqual({});
    expect(getCost('oneHour')).toEqual({});
  });

  test("an unknown type costs nothing rather than throwing", () => {
    expect(getCost('somethingRemoved')).toEqual({});
  });
});

describe("canSpend", () => {
  test("is ok out of combat", () => {
    expect(canSpend(makeActor(), 'standard').ok).toBe(true);
  });

  test("is ok when tracking is off", () => {
    setGame({ combatant: makeCombatant(), mode: 'off' });
    expect(canSpend(makeActor(), 'standard').ok).toBe(true);
  });

  test("is ok when the actor has opted out", () => {
    setGame({ combatant: makeCombatant() });
    expect(canSpend(makeActor({ enabled: false }), 'standard').ok).toBe(true);
  });

  test("reports the categories that fell short", async () => {
    const combatant = makeCombatant();
    setGame({ combatant });
    const actor = makeActor();

    await spend(actor, 'standard');
    const check = canSpend(actor, 'fullAction');

    expect(check.ok).toBe(false);
    expect(check.shortfall).toEqual(['standard']);
  });

  test("Free actions run out - the rules cap them at Speed minus 2", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor({ free: 1 });

    await spend(actor, "free");

    expect(canSpend(actor, "free").ok).toBe(false);
  });

  test("a Condition that zeroes Free actions makes them unaffordable", () => {
    setGame({ combatant: makeCombatant() });
    expect(canSpend(makeActor({ free: 0 }), 'free').ok).toBe(false);
  });
});

describe("spend", () => {
  test("records the cost, the source and a returned id", async () => {
    const combatant = makeCombatant();
    setGame({ combatant });
    const actor = makeActor();

    const result = await spend(actor, 'standard', { source: 'Blaster' });

    expect(result.ok).toBe(true);
    expect(result.spendId).toBeTruthy();
    const ledger = getLedger(actor);
    expect(ledger.standard).toBe(1);
    expect(ledger.log).toHaveLength(1);
    expect(ledger.log[0].source).toBe('Blaster');
  });

  test("spends both halves of a Full Action together", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    await spend(actor, 'fullAction');

    expect(getRemaining(actor)).toEqual({ standard: 0, move: 0, free: 0 });
  });

  test("takes neither half when strict mode blocks an unaffordable Full Action", async () => {
    setGame({ combatant: makeCombatant(), mode: 'strict' });
    const actor = makeActor();

    await spend(actor, 'standard');
    const result = await spend(actor, 'fullAction');

    expect(result.blocked).toBe(true);
    expect(getRemaining(actor).move).toBe(1);
  });

  test("overspends without blocking in track mode, so the overdraft is visible", async () => {
    setGame({ combatant: makeCombatant(), mode: 'track' });
    const actor = makeActor();

    await spend(actor, 'standard');
    const result = await spend(actor, 'standard');

    expect(result.blocked).toBe(false);
    expect(getLedger(actor).standard).toBe(2);
  });

  test("bypass spends nothing and still reports ok", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    const result = await spend(actor, 'standard', { bypass: true });

    expect(result.ok).toBe(true);
    expect(result.spendId).toBeNull();
    expect(getLedger(actor).standard).toBe(0);
  });

  test("a Whole Turn action marks the next turn consumed", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    await spend(actor, 'wholeTurn');

    expect(getLedger(actor).turnConsumed).toBe(true);
  });

  test("routes through the socket when the user can't modify the document", async () => {
    const combatant = makeCombatant({ isOwner: false });
    setGame({ combatant });

    await spend(makeActor(), 'standard');

    expect(combatant.setFlag).not.toHaveBeenCalled();
    expect(global.game.socket.emit).toHaveBeenCalledWith('system.essence20', expect.objectContaining({
      action: 'setActionLedger',
    }));
  });
});

describe("refund", () => {
  test("hands back exactly what the matching spend took", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    const { spendId } = await spend(actor, 'fullAction');
    expect(await refund(actor, spendId)).toBe(true);

    expect(getRemaining(actor)).toEqual({ standard: 1, move: 1, free: 0 });
    expect(getLedger(actor).log).toHaveLength(0);
  });

  test("a second refund of the same id is a no-op, so actions can't be handed back twice", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    const { spendId } = await spend(actor, 'standard');
    await refund(actor, spendId);

    expect(await refund(actor, spendId)).toBe(false);
    expect(getRemaining(actor).standard).toBe(1);
  });

  test("clears the Whole Turn marker it set", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    const { spendId } = await spend(actor, 'wholeTurn');
    await refund(actor, spendId);

    expect(getLedger(actor).turnConsumed).toBe(false);
  });

  test("returns false for a null id or out of combat", async () => {
    expect(await refund(makeActor(), null)).toBe(false);
    expect(await refund(makeActor(), 'id1')).toBe(false);
  });
});

describe("adjust", () => {
  test("spends and returns single actions by hand", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    await adjust(actor, 'standard', 1);
    expect(getRemaining(actor).standard).toBe(0);

    await adjust(actor, 'standard', -1);
    expect(getRemaining(actor).standard).toBe(1);
  });

  test("never drops a category below zero", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    await adjust(actor, 'standard', -5);
    expect(getLedger(actor).standard).toBe(0);
  });

  test("rejects an unknown category", async () => {
    setGame({ combatant: makeCombatant() });
    expect(await adjust(makeActor(), 'bonusAction', 1)).toBe(false);
  });
});

describe("resetTurn", () => {
  test("clears the ledger for an ordinary turn", async () => {
    const combatant = makeCombatant();
    setGame({ combatant });
    const actor = makeActor();
    combatant.actor = actor;

    await spend(actor, 'fullAction');
    await resetTurn(combatant);

    expect(getRemaining(actor)).toEqual({ standard: 1, move: 1, free: 0 });
  });

  test("a turn consumed by Whole Turn starts empty, and the turn after refills", async () => {
    const combatant = makeCombatant();
    setGame({ combatant });
    const actor = makeActor();
    combatant.actor = actor;

    await spend(actor, 'wholeTurn');

    await resetTurn(combatant);
    expect(getRemaining(actor)).toEqual({ standard: 0, move: 0, free: 0 });

    await resetTurn(combatant);
    expect(getRemaining(actor)).toEqual({ standard: 1, move: 1, free: 0 });
  });

  test("is a no-op for a document without flags", async () => {
    await expect(resetTurn(null)).resolves.toBeUndefined();
  });
});

describe("consumeForItem", () => {
  test("spends what the item's actionType costs", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();
    const item = { name: 'Blaster', actor, system: { actionType: 'standard' } };

    const result = await consumeForItem(item);

    expect(result.actionType).toBe('standard');
    expect(getRemaining(actor).standard).toBe(0);
    expect(getLedger(actor).log[0].source).toBe('Blaster');
  });

  test("an item with no authored action cost spends nothing", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    await consumeForItem({ name: 'Tough', actor, system: {} });

    expect(getRemaining(actor)).toEqual({ standard: 1, move: 1, free: 0 });
  });

  test("ignoresEconomy opts an item out entirely", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    const result = await consumeForItem({
      name: 'Reflexive Parry', actor, system: { actionType: 'standard', ignoresEconomy: true },
    });

    expect(result.ok).toBe(true);
    expect(getRemaining(actor).standard).toBe(1);
  });

  test("spends from the overriding roller rather than the item's own parent", async () => {
    setGame({ combatant: makeCombatant() });
    const driver = makeActor({ name: 'Scarlett' });
    const vehicle = makeActor({ name: 'VAMP' });

    await consumeForItem({ name: 'Ram', actor: vehicle, system: { actionType: 'standard' } }, { actor: driver });

    expect(getLedger(driver).standard).toBe(1);
  });

  test("is ok for an item with no actor at all", async () => {
    const result = await consumeForItem({ name: 'Loose', system: { actionType: 'standard' } });
    expect(result.ok).toBe(true);
  });
});

describe("describeCost", () => {
  test("lists each category the cost touches", () => {
    expect(describeCost({ standard: 1, move: 1 }))
      .toBe('E20.ActionTypeStandard, E20.ActionTypeMove');
  });

  test("an empty cost describes as an empty string", () => {
    expect(describeCost({})).toBe('');
    expect(describeCost(null)).toBe('');
  });
});

describe("getSheetContext", () => {
  test("is null out of combat, with tracking off, or for an opted-out actor", () => {
    expect(getSheetContext(makeActor())).toBeNull();

    setGame({ combatant: makeCombatant(), mode: 'off' });
    expect(getSheetContext(makeActor())).toBeNull();

    setGame({ combatant: makeCombatant() });
    expect(getSheetContext(makeActor({ enabled: false }))).toBeNull();
  });

  test("draws one pip per point of budget, marking the spent ones", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor({ standard: 2 });

    await spend(actor, 'standard');
    const standard = getSheetContext(actor).categories.find(c => c.key == 'standard');

    expect(standard.pips).toEqual([{ spent: true }, { spent: false }]);
  });

  test("draws extra pips for an overdraft, so a track-mode overspend is visible", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    await spend(actor, 'standard');
    await spend(actor, 'standard');
    const standard = getSheetContext(actor).categories.find(c => c.key == 'standard');

    expect(standard.pips).toEqual([{ spent: true }, { spent: true }]);
  });

  test("a category with no budget this turn draws no pips", () => {
    setGame({ combatant: makeCombatant() });
    const free = getSheetContext(makeActor({ free: 0 })).categories.find(c => c.key == "free");

    expect(free.max).toBe(0);
    expect(free.pips).toEqual([]);
  });

  test("reports a turn consumed by a previous Whole Turn action", async () => {
    const combatant = makeCombatant();
    setGame({ combatant });
    const actor = makeActor();
    combatant.actor = actor;

    await spend(actor, 'wholeTurn');
    await resetTurn(combatant);

    expect(getSheetContext(actor).turnSkipped).toBe(true);
  });
});

describe("settings robustness", () => {
  // Foundry throws outright on an unregistered setting, and these run from prepareDerivedData and
  // sheet rendering - both of which can fire during 'setup', before registerSettings() has run.
  test("an unregistered setting falls back to track rather than throwing", () => {
    global.game.settings.get = jest.fn(() => {
      throw new Error('not a registered game setting');
    });

    expect(getMode()).toBe('track');
    expect(() => getCombatant(makeActor())).not.toThrow();
  });
});

describe("warn mode", () => {
  let confirmMock;

  beforeEach(() => {
    confirmMock = jest.fn(async () => true);
    global.foundry.applications = { api: { DialogV2: { confirm: confirmMock } } };
  });

  test("asks before letting an unaffordable spend through, and proceeds on yes", async () => {
    setGame({ combatant: makeCombatant(), mode: 'warn' });
    const actor = makeActor();

    await spend(actor, 'standard');
    const result = await spend(actor, 'standard');

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(result.blocked).toBe(false);
    expect(getLedger(actor).standard).toBe(2);
  });

  test("blocks and spends nothing when the player says no", async () => {
    confirmMock.mockResolvedValue(false);
    setGame({ combatant: makeCombatant(), mode: 'warn' });
    const actor = makeActor();

    await spend(actor, 'standard');
    const result = await spend(actor, 'standard');

    expect(result.blocked).toBe(true);
    expect(result.cancelled).toBe(true);
    expect(getLedger(actor).standard).toBe(1);
  });

  test("doesn't ask when the actor can afford it", async () => {
    setGame({ combatant: makeCombatant(), mode: 'warn' });

    await spend(makeActor(), 'standard');

    expect(confirmMock).not.toHaveBeenCalled();
  });

  test("doesn't ask a GM - they drive every NPC through the unauthored long tail", async () => {
    setGame({ combatant: makeCombatant(), mode: 'warn', isGM: true });
    const actor = makeActor();

    await spend(actor, 'standard');
    await spend(actor, 'standard');

    expect(confirmMock).not.toHaveBeenCalled();
    expect(getLedger(actor).standard).toBe(2);
  });

  test("degrades to track behaviour when no dialog is available", async () => {
    delete global.foundry.applications;
    setGame({ combatant: makeCombatant(), mode: 'warn' });
    const actor = makeActor();

    await spend(actor, 'standard');
    const result = await spend(actor, 'standard');

    expect(result.blocked).toBe(false);
  });

  test("strict still refuses outright, without asking", async () => {
    setGame({ combatant: makeCombatant(), mode: 'strict' });
    const actor = makeActor();

    await spend(actor, 'standard');
    const result = await spend(actor, 'standard');

    expect(confirmMock).not.toHaveBeenCalled();
    expect(result.blocked).toBe(true);
    expect(result.cancelled).toBeUndefined();
  });
});

// GI Joe CRB p.192-193. These are the rules the whole budget model rests on, so they get explicit
// tests rather than being implied by the fixtures.
describe("Speed 1 shared action", () => {
  test("spending the Standard also consumes the Move, and vice versa", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor({ shared: true });

    await spend(actor, 'standard');

    expect(getRemaining(actor)).toEqual({ standard: 0, move: 0, free: 0 });
  });

  test("spending the Move also consumes the Standard", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor({ shared: true });

    await spend(actor, 'move');

    expect(getRemaining(actor)).toEqual({ standard: 0, move: 0, free: 0 });
  });

  test("an unshared actor keeps the other action", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    await spend(actor, 'standard');

    expect(getRemaining(actor).move).toBe(1);
  });

  test("the sheet says why both pips went at once", () => {
    setGame({ combatant: makeCombatant() });
    expect(getSheetContext(makeActor({ shared: true })).shared).toBe(true);
    expect(getSheetContext(makeActor()).shared).toBe(false);
  });
});

describe("tradeStandardForFree", () => {
  test("spends the Standard and grants two Free actions", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    expect(await tradeStandardForFree(actor)).toBe(true);

    expect(getRemaining(actor).standard).toBe(0);
    expect(getRemaining(actor).free).toBe(2);
  });

  test("the granted Free actions are spendable", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    await tradeStandardForFree(actor);
    await spend(actor, 'free');

    expect(getRemaining(actor).free).toBe(1);
  });

  test("adds to an existing Free budget rather than replacing it", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor({ free: 1 });

    await tradeStandardForFree(actor);

    expect(getRemaining(actor).free).toBe(3);
  });

  test("refuses when there's no Standard action left to trade", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    await spend(actor, 'standard');

    expect(await tradeStandardForFree(actor)).toBe(false);
  });

  test("refuses out of combat, where there is no ledger", async () => {
    expect(await tradeStandardForFree(makeActor())).toBe(false);
  });

  test("the sheet offers the trade only while a Standard remains", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    expect(getSheetContext(actor).canTrade).toBe(true);
    await spend(actor, 'standard');
    expect(getSheetContext(actor).canTrade).toBe(false);
  });
});

describe("contingency", () => {
  // The Contingency action (CRB p.196) is Essence20's readied-action mechanism, and it spends a
  // Standard action - there is no separate reaction resource anywhere in the rules.
  test("costs a Standard action", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    await spend(actor, 'contingency');

    expect(getRemaining(actor).standard).toBe(0);
  });

  test("is unaffordable once the Standard is gone", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    await spend(actor, 'standard');

    expect(canSpend(actor, 'contingency').shortfall).toEqual(['standard']);
  });
});

/**
 * Pulls one group out of the tab context by category key.
 */
function group(context, key) {
  return context.groups.find(g => g.key === key);
}

/**
 * Finds a named action anywhere in the tab context, whichever group it landed in.
 */
function namedAction(context, key) {
  return context.groups.flatMap(g => g.actions).find(a => a.key === key);
}

/* One aim per shot.

   Aim is a Free action and a character can have several, so this is deliberately not a budget
   rule: the check has to be separate from canSpend, and the state has to survive between the
   aim and the shot. It clears on the shot rather than at end of turn, which is what "once per
   roll" means. */
describe("aiming", () => {
  test("an actor is not aiming until they aim", () => {
    setGame({ combatant: makeCombatant() });

    expect(isAiming(makeActor())).toBe(false);
  });

  test("setAiming records and clears the aim", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();

    await setAiming(actor, true);
    expect(isAiming(actor)).toBe(true);

    await setAiming(actor, false);
    expect(isAiming(actor)).toBe(false);
  });

  // The gate is not the budget: the Free action is still there, the shot is what is used up.
  test("the tab marks Aim unavailable while a shot is already aimed, with Free left", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor({ free: 2 });
    await setAiming(actor, true);

    const context = getActionsTabContext(actor);
    const aim = namedAction(context, 'aim');

    expect(aim).toMatchObject({ affordable: false, alreadyAimed: true });
    expect(group(context, 'free').remaining).toBe(2);
    expect(namedAction(context, 'freeAction').affordable).toBe(true);
  });

  test("Aim is available again once the aim is cleared", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor({ free: 2 });
    await setAiming(actor, true);
    await setAiming(actor, false);

    expect(namedAction(getActionsTabContext(actor), 'aim'))
      .toMatchObject({ affordable: true, alreadyAimed: false });
  });

  test("a new turn starts with no aim held over", async () => {
    const combatant = makeCombatant();
    setGame({ combatant });
    const actor = makeActor();
    await setAiming(actor, true);

    await resetTurn(combatant);

    expect(isAiming(actor)).toBe(false);
  });

  // Out of combat there is no ledger to hold the aim, and nothing should be written.
  test("setAiming is a no-op with no combatant", async () => {
    setGame({ combatant: null });

    await expect(setAiming(makeActor(), true)).resolves.toBeUndefined();
  });
});
describe("getActionsTabContext: the rules' own actions", () => {
  test("files every named action under the category its cost falls on", () => {
    setGame({ combatant: makeCombatant() });

    const context = getActionsTabContext(makeActor({ free: 1 }));

    expect(group(context, 'standard').actions.map(a => a.key)).toContain('defend');
    expect(group(context, 'move').actions.map(a => a.key)).toContain('move');
    expect(group(context, 'free').actions.map(a => a.key)).toContain('freeAction');
  });

  // Two books say so: "when you Aim as a Free action" (GI Joe CRB) and "for each Free action you
  // spend Aiming" (TF CRB). The second is why the tab uses a button - the same action, twice.
  test("Aim is a Free action", () => {
    setGame({ combatant: makeCombatant() });

    expect(group(getActionsTabContext(makeActor({ free: 1 })), 'free').actions.map(a => a.key))
      .toContain('aim');
  });

  // Contingency is a Standard action (GI Joe CRB p.196); the tab must not invent a fourth
  // category for it, and the cost comes from actionTypeCosts rather than being restated here.
  test("a Contingency is filed as a Standard action", () => {
    setGame({ combatant: makeCombatant() });

    expect(group(getActionsTabContext(makeActor()), 'standard').actions.map(a => a.key))
      .toContain('contingency');
  });

  // A Full Action spends a Standard AND a Move, so it can only be filed once - under the heavier
  // of the two, with its own row spelling the rest out.
  test("an item costing two categories is filed under the heavier one, and says so", () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor({
      items: [{ _id: 'i1', name: 'Charge', type: 'perk', system: { actionType: 'fullAction' } }],
    });

    const context = getActionsTabContext(actor);

    expect(group(context, 'standard').items.map(i => i.item.name)).toEqual(['Charge']);
    expect(group(context, 'move').items).toEqual([]);
    expect(group(context, 'standard').items[0].costLabel).toContain('E20.ActionTypeMove');
  });

  // ~2,600 Perks carry no authored cost. Listing them would bury the handful that do.
  test("leaves out items with no cost and items that opt out of the economy", () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor({
      items: [
        { _id: 'i1', name: 'Passive', type: 'perk', system: { actionType: 'none' } },
        { _id: 'i2', name: 'Untracked', type: 'perk',
          system: { actionType: 'standard', ignoresEconomy: true } },
        { _id: 'i3', name: 'Counted', type: 'weapon', system: { actionType: 'standard' } },
      ],
    });

    expect(group(getActionsTabContext(actor), 'standard').items.map(i => i.item.name))
      .toEqual(['Counted']);
  });

  test("marks an action the actor can no longer afford", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();
    await spend(actor, 'standard');

    const context = getActionsTabContext(actor);

    expect(namedAction(context, 'defend').affordable).toBe(false);
    expect(namedAction(context, 'move').affordable).toBe(true);
  });

  test("reports what is left of each budget", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor({ standard: 2 });
    await spend(actor, 'standard');

    expect(group(getActionsTabContext(actor), 'standard')).toMatchObject({ remaining: 1, max: 2 });
  });

  /* The tab is shown out of combat too - it answers "what can I do and what does it cost", which
     is worth reading while planning a character. What changes is `live`: there is no ledger, so no
     budget numbers, and the rules' own actions are reference only. Taking one would spend from a
     ledger that does not exist, and Defend would apply a Condition nothing ever clears. */
  test("still builds a context with no combatant, but not a live one", () => {
    setGame({ combatant: null });

    const context = getActionsTabContext(makeActor());

    expect(context).not.toBeNull();
    expect(context.live).toBe(false);
    expect(group(context, 'standard').actions.map(a => a.key)).toContain('defend');
  });

  test("is live once there is a combatant to hold the ledger", () => {
    setGame({ combatant: makeCombatant() });

    expect(getActionsTabContext(makeActor()).live).toBe(true);
  });

  // Nothing is unaffordable when there is no budget to fall short of.
  test("marks nothing unaffordable out of combat", () => {
    setGame({ combatant: null });

    const context = getActionsTabContext(makeActor({ free: 0 }));

    expect(namedAction(context, 'aim').affordable).toBe(true);
    expect(namedAction(context, 'defend').affordable).toBe(true);
  });

  /* Only an actor with no action economy at all gets nothing - which is what the sheet checks
     before rendering the tab. */
  test("returns null for an actor with no action economy", () => {
    setGame({ combatant: null });
    const actor = makeActor();
    delete actor.system.actions;

    expect(getActionsTabContext(actor)).toBeNull();
  });

  // spend() has always recorded a source; until now nothing read it back, so a player could see a
  // Standard was gone without seeing what took it.
  test("reports what was spent this turn, newest first", async () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor({ free: 2 });
    await spend(actor, 'standard', { source: 'Defend' });
    await spend(actor, 'free', { source: 'Draw a weapon' });

    expect(getSheetContext(actor).spent.map(s => s.source)).toEqual(['Draw a weapon', 'Defend']);
  });

  test("reports nothing spent on a fresh turn", () => {
    setGame({ combatant: makeCombatant() });

    expect(getSheetContext(makeActor()).spent).toEqual([]);
  });
});

/**
 * Finds the Attack row, which is where weapon effects hang.
 */
function attackRow(context) {
  return context.groups.flatMap(g => g.actions).find(a => a.key === 'attack');
}

/* Where an item lands on the Actions tab.

   A weapon effect IS the Attack action - it is the thing that rolls, since a weapon has no roll
   button anywhere in the sheet - so it hangs off the Attack row rather than sitting loose in the
   Standard group beside it. */
describe("getActionsTabContext: where an item lands", () => {
  test("a weapon effect hangs off the Attack row, not the Standard group", () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor({
      items: [{ _id: 'w1', name: 'Rifle Effect', type: 'weaponEffect', system: { actionType: 'standard' } }],
    });

    const context = getActionsTabContext(actor);

    expect(attackRow(context).children.map(c => c.item.name)).toEqual(['Rifle Effect']);
    expect(group(context, 'standard').items).toEqual([]);
  });

  /* Whatever its own cost says. An effect someone has set to Free is still a way of taking the
     Attack action, and filing it away from Attack would hide it; the row still shows Free. */
  test("a weapon effect with an unusual cost still nests under Attack", () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor({
      free: 1,
      items: [{ _id: 'w1', name: 'Quick Shot', type: 'weaponEffect', system: { actionType: 'free' } }],
    });

    const context = getActionsTabContext(actor);

    expect(attackRow(context).children.map(c => c.item.name)).toEqual(['Quick Shot']);
    expect(group(context, 'free').items).toEqual([]);
    expect(attackRow(context).children[0].costLabel).toContain('E20.ActionTypeFree');
  });

  test("a weapon effect is named under its parent when its own name does not say it", () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor({
      items: [
        { _id: 'gun', name: 'Fang Handgun', type: 'weapon', system: { actionType: 'none' } },
        {
          _id: 'e1', name: 'New WeaponEffect', type: 'weaponEffect',
          system: { actionType: 'standard' }, flags: { essence20: { parentId: 'gun' } },
        },
        {
          _id: 'e2', name: 'Fang Handgun Effect', type: 'weaponEffect',
          system: { actionType: 'standard' }, flags: { essence20: { parentId: 'gun' } },
        },
      ],
    });
    actor.items.get = (id) => actor.items.find(i => i._id === id);

    const children = attackRow(getActionsTabContext(actor)).children;

    expect(children.find(c => c.item.name === 'New WeaponEffect').parentName).toBe('Fang Handgun');
    expect(children.find(c => c.item.name === 'Fang Handgun Effect').parentName).toBeNull();
  });

  // Everything else that costs something stays in its own cost group.
  test("a costed item that is not a weapon effect stays in its group", () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor({
      items: [{ _id: 'p1', name: 'Kitbash', type: 'perk', system: { actionType: 'standard' } }],
    });

    const context = getActionsTabContext(actor);

    expect(group(context, 'standard').items.map(i => i.item.name)).toEqual(['Kitbash']);
    expect(attackRow(context).children).toEqual([]);
  });
});

/* Mark Target (TF CRB) is the one entry in the Perk activation registry canUsePerk answers true
   for with no further gate, which makes it the cheapest way to exercise the REAL predicate here
   rather than a stub. If that id ever moves, these fail - which is the point: this tab and the
   Perks tab's own Use button have to keep answering the same question. */
const MARK_TARGET_SOURCE = 'Compendium.essence20.tf_crb.Item.T2mm6VmvcUxagsjc';

/**
 * A Perk canUsePerk recognises. `parent` is what it reads the actor off.
 */
function activatablePerk(actor, { name = 'Mark Target', actionType = 'none' } = {}) {
  return {
    _id: 'p1',
    name,
    type: 'perk',
    parent: actor,
    system: { actionType },
    _stats: { compendiumSource: MARK_TARGET_SOURCE },
  };
}

/* Most of the ~2,600 Perks carry no authored action cost, so filtering on cost alone would miss
   exactly the ones a player wants to find on their turn. */
describe("getActionsTabContext: activatable Perks", () => {
  test("an activatable Perk with no cost lands in the untimed list", () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor();
    actor.items = [activatablePerk(actor, { name: 'Think On It' })];

    const context = getActionsTabContext(actor);

    expect(context.untimed.map(e => e.item.name)).toEqual(['Think On It']);
    expect(context.untimed[0].activatable).toBe(true);
    expect(context.untimed[0].costLabel).toBeNull();
  });

  // Both reasons at once files it once, under its cost, with the Use button it has earned.
  test("an activatable Perk that also costs something is filed under the cost, once", () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor({ free: 1 });
    actor.items = [activatablePerk(actor, { name: 'Bulwark', actionType: 'free' })];

    const context = getActionsTabContext(actor);

    expect(context.untimed).toEqual([]);
    expect(group(context, 'free').items.map(e => e.item.name)).toEqual(['Bulwark']);
    expect(group(context, 'free').items[0].activatable).toBe(true);
  });

  /* A Perk that has spent its once-per-turn drops off this tab exactly as its bolt icon disappears
     from the Perks tab - canUsePerk answers both. An unrecognised Perk is the same "no" from the
     same function. */
  test("a Perk canUsePerk says no to is left off", () => {
    setGame({ combatant: makeCombatant() });
    const actor = makeActor({
      items: [{ _id: 'p1', name: 'Sneak Attack', type: 'perk', system: { actionType: 'none' } }],
    });

    const context = getActionsTabContext(actor);

    expect(context.untimed).toEqual([]);
    expect(group(context, 'standard').items).toEqual([]);
  });
});
