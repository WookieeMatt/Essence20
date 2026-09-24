import { jest } from '@jest/globals';
import {
  consumeForMovement,
  getMovementAllowance,
  isMovementTracked,
  getPushRules,
  movementTypeFor,
  planPush,
} from './token-movement.mjs';
import { getLedger, getRemaining, isAiming, setAiming, setSprinting } from './action-economy.mjs';
import { Essence20TokenDocument } from '../documents/token.mjs';

let idCounter = 0;

global.foundry = { utils: { randomID: jest.fn(() => `id${++idCounter}`) } };


function makeActor({ enabled = true, ground = 30, aerial = 0, move = 1, free = 0, name = 'Duke' } = {}) {
  return {
    name,
    token: { id: 'token1' },
    system: {
      actions: {
        enabled,
        shared: false,
        standard: { base: 1, bonus: 0, max: 1 },
        move: { base: 1, bonus: 0, max: move },
        free: { base: free, bonus: 0, max: free },
      },
      movement: {
        ground: { total: ground },
        aerial: { total: aerial },
      },
    },
  };
}

function makeToken(actor, id = 'token1') {
  return { id, actor };
}

function makeCombatant(actor, tokenId = 'token1') {
  const flags = {};
  return {
    actor,
    tokenId,
    isOwner: true,
    group: null,
    getFlag: (scope, key) => flags[key],
    setFlag: async (scope, key, value) => {
      flags[key] = value;
    },
  };
}

/**
 * A v14 TokenMovementOperation, shaped from one captured live in Foundry rather than guessed.
 *
 * The important details, all of which an earlier invented fixture got wrong: the leg being walked
 * right now lands in `passed` (`pending` is empty for an ordinary move), the movement action lives
 * on a WAYPOINT rather than on `destination`, and `destination` carries only geometry.
 */
function makeMovement({
  cost = 10, travelled = 0, pendingCost = 0, action = 'walk', method = 'dragging',
  recorded = true, teleport = null,
} = {}) {
  return {
    method,
    recorded,
    origin: { x: 1000, y: 1000 },
    destination: { x: 1100, y: 1000, elevation: 0, width: 1, height: 1, depth: 0, shape: 0, level: '' },
    passed: {
      waypoints: [{ x: 1100, y: 1000, action, teleport, cost, snapped: true, explicit: true }],
      cost,
    },
    pending: { waypoints: [], cost: pendingCost },
    history: { recorded: { cost: travelled }, unrecorded: { cost: 0 }, cost: travelled },
  };
}

function setGame({
  actor, movementOn = true, mode = 'track', isGM = false, combatantTokenId = 'token1',
} = {}) {
  const combatant = actor ? makeCombatant(actor, combatantTokenId) : null;
  global.game = {
    user: { isGM, isActiveGM: isGM },
    i18n: { localize: jest.fn(key => key), format: jest.fn(key => key) },
    settings: {
      get: jest.fn((scope, key) => {
        if (key === 'actionEconomyMode') return mode;
        if (key === 'actionEconomyMovement') return movementOn;
        return undefined;
      }),
    },
    combat: combatant
      ? { combatants: [combatant], combatant, getCombatantsByActor: () => [combatant] }
      : null,
    socket: { emit: jest.fn() },
  };

  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  return combatant;
}

beforeEach(() => {
  idCounter = 0;
  setGame();
});

describe("movementTypeFor", () => {
  test.each([['walk', 'ground'], ['crawl', 'ground'], ['jump', 'ground'], ['fly', 'aerial'],
    ['swim', 'swim'], ['burrow', 'burrow'], ['climb', 'climb']])(
    "maps %s to %s", (action, expected) => {
      expect(movementTypeFor(action)).toBe(expected);
    },
  );

  // Teleports are not movement in the rules' sense, and an unknown action may come from a module.
  test.each(['blink', 'displace', 'somethingAModuleAdded'])("does not map %s", (action) => {
    expect(movementTypeFor(action)).toBeNull();
  });
});

describe("getMovementAllowance", () => {
  test("reads the derived total for the movement type", () => {
    expect(getMovementAllowance(makeActor({ ground: 40 }), 'ground')).toBe(40);
  });

  test("is null for a movement type the actor doesn't have", () => {
    expect(getMovementAllowance(makeActor(), 'swim')).toBeNull();
    expect(getMovementAllowance(undefined, 'ground')).toBeNull();
  });
});

describe("isMovementTracked", () => {
  test("needs both the main setting and the movement sub-setting", () => {
    setGame({ movementOn: true, mode: 'track' });
    expect(isMovementTracked()).toBe(true);

    setGame({ movementOn: false, mode: 'track' });
    expect(isMovementTracked()).toBe(false);

    setGame({ movementOn: true, mode: 'off' });
    expect(isMovementTracked()).toBe(false);
  });

  test("is false rather than throwing when the settings aren't registered", () => {
    global.game = { settings: { get: () => {
      throw new Error('not registered');
    } } };
    expect(isMovementTracked()).toBe(false);
  });
});

describe("consumeForMovement", () => {
  test("spends the Move action on the first movement of a turn", async () => {
    const actor = makeActor();
    setGame({ actor });

    await consumeForMovement(makeToken(actor), makeMovement({ cost: 10 }));

    expect(getRemaining(actor).move).toBe(0);
    expect(getLedger(actor).log[0].actionType).toBe('move');
  });

  // The rules let a character split their movement around their Standard action, so the second
  // leg of the same turn is part of the same Move action and costs nothing further.
  test("does not spend a second Move action later in the same turn", async () => {
    const actor = makeActor();
    setGame({ actor });

    await consumeForMovement(makeToken(actor), makeMovement({ cost: 10 }));
    await consumeForMovement(makeToken(actor), makeMovement({ cost: 20 }));

    expect(getLedger(actor).log).toHaveLength(1);
  });

  test.each(['api', 'undo', 'paste', 'config', 'hud'])(
    "ignores %s movement - not a character walking", async (method) => {
      const actor = makeActor();
      setGame({ actor });

      await consumeForMovement(makeToken(actor), makeMovement({ method }));

      expect(getRemaining(actor).move).toBe(1);
    },
  );

  test("ignores a teleport", async () => {
    const actor = makeActor();
    setGame({ actor });

    await consumeForMovement(makeToken(actor), makeMovement({ teleport: true }));

    expect(getRemaining(actor).move).toBe(1);
  });

  test("ignores unrecorded movement, which is what happens out of combat", async () => {
    const actor = makeActor();
    setGame({ actor });

    await consumeForMovement(makeToken(actor), makeMovement({ recorded: false }));

    expect(getRemaining(actor).move).toBe(1);
  });

  // Forced or out-of-turn movement must not eat a Move action the actor hasn't taken yet.
  test("ignores movement on someone else's turn", async () => {
    const actor = makeActor();
    setGame({ actor, combatantTokenId: 'someoneElse' });

    await consumeForMovement(makeToken(actor), makeMovement());

    expect(getRemaining(actor).move).toBe(1);
  });

  test("does nothing when the actor has opted out of tracking", async () => {
    const actor = makeActor({ enabled: false });
    setGame({ actor });

    await consumeForMovement(makeToken(actor), makeMovement());

    expect(getRemaining(actor).move).toBe(1);
  });

  test("allows movement within the actor's rating", async () => {
    const actor = makeActor({ ground: 30 });
    setGame({ actor });

    expect(await consumeForMovement(makeToken(actor), makeMovement({ cost: 30 }))).toBe(true);
    expect(global.ui.notifications.info).not.toHaveBeenCalled();
    expect(global.ui.notifications.warn).not.toHaveBeenCalled();
  });

  test("reports but allows an unaffordable overrun in track mode", async () => {
    const actor = makeActor({ ground: 30, free: 0 });
    setGame({ actor, mode: 'track' });

    expect(await consumeForMovement(makeToken(actor), makeMovement({ cost: 45 }))).toBe(true);
    // Track mode blocks nothing, but still says WHY the movement was flagged - as a warning,
    // since an overrun is one whether or not it was stopped.
    expect(global.ui.notifications.warn)
      .toHaveBeenCalledWith('E20.ActionEconomyMovementUnaffordable');
    expect(global.ui.notifications.info).not.toHaveBeenCalled();
  });

  test("rejects an overrun in strict mode", async () => {
    const actor = makeActor({ ground: 30 });
    setGame({ actor, mode: 'strict' });

    expect(await consumeForMovement(makeToken(actor), makeMovement({ cost: 45 }))).toBe(false);
    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });

  test("a GM is never blocked, even in strict mode", async () => {
    const actor = makeActor({ ground: 30 });
    setGame({ actor, mode: 'strict', isGM: true });

    expect(await consumeForMovement(makeToken(actor), makeMovement({ cost: 45 }))).toBe(true);
  });

  test("asks before an overrun in warn mode, and honours the answer", async () => {
    const actor = makeActor({ ground: 30 });
    setGame({ actor, mode: 'warn' });
    global.foundry.applications = { api: { DialogV2: { confirm: jest.fn(async () => false) } } };

    expect(await consumeForMovement(makeToken(actor), makeMovement({ cost: 45 }))).toBe(false);

    global.foundry.applications.api.DialogV2.confirm = jest.fn(async () => true);
    expect(await consumeForMovement(makeToken(actor), makeMovement({ cost: 45 }))).toBe(true);
  });

  test("measures flight against the aerial rating, not the ground one", async () => {
    const actor = makeActor({ ground: 30, aerial: 60 });
    setGame({ actor, mode: 'strict' });

    expect(await consumeForMovement(makeToken(actor), makeMovement({ cost: 45, action: 'fly' }))).toBe(true);
  });

  test("does not measure a movement type the actor has no rating for", async () => {
    const actor = makeActor({ ground: 30 });
    setGame({ actor, mode: 'strict' });

    expect(await consumeForMovement(makeToken(actor), makeMovement({ cost: 999, action: 'swim' }))).toBe(true);
  });

  test("is inert with the movement setting off", async () => {
    const actor = makeActor();
    setGame({ actor, movementOn: false, mode: 'strict' });

    expect(await consumeForMovement(makeToken(actor), makeMovement({ cost: 999 }))).toBe(true);
    expect(getRemaining(actor).move).toBe(1);
  });
});

describe("budget accounting across a split move", () => {
  // v14 stores what has already been travelled (`history`) separately from the leg about to be
  // walked (`pending`). Checking only the first would let a character overshoot by a whole extra
  // move before anything complained.
  test("counts the pending leg, not just what has already been travelled", async () => {
    const actor = makeActor({ ground: 30 });
    setGame({ actor, mode: 'strict' });

    // 20ft already walked this turn, now trying to walk 20ft more: 40 > 30.
    const result = await consumeForMovement(
      makeToken(actor), makeMovement({ travelled: 20, cost: 20 }),
    );

    expect(result).toBe(false);
  });

  test("allows a split move that stays within the rating overall", async () => {
    const actor = makeActor({ ground: 30 });
    setGame({ actor, mode: 'strict' });

    const result = await consumeForMovement(
      makeToken(actor), makeMovement({ travelled: 20, cost: 10 }),
    );

    expect(result).toBe(true);
  });
});

describe("reading the real movement operation shape", () => {
  /* These pin the two things live testing caught. The original fixture was invented rather than
     captured: it put the movement action on a pending waypoint and the cost in `pending.cost`.
     In a real operation the leg being walked is already in `passed`, `pending` is empty, and
     `destination` carries only geometry - so the old code found no action, bailed out, and
     charged nothing at all while every test still passed. */
  test("finds the movement action on a passed waypoint", async () => {
    const actor = makeActor();
    setGame({ actor });

    await consumeForMovement(makeToken(actor), makeMovement({ action: 'walk' }));

    expect(getRemaining(actor).move).toBe(0);
  });

  test("charges nothing when no waypoint carries an action", async () => {
    const actor = makeActor();
    setGame({ actor });
    const movement = makeMovement();
    movement.passed.waypoints = [{ x: 1, y: 1 }];

    await consumeForMovement(makeToken(actor), movement);

    expect(getRemaining(actor).move).toBe(1);
  });

  test("counts the leg being walked, not just what came before it", async () => {
    const actor = makeActor({ ground: 30 });
    setGame({ actor, mode: 'strict' });

    // 25ft recorded earlier plus a 10ft leg now = 35 > 30. Summing only history would pass.
    const result = await consumeForMovement(
      makeToken(actor), makeMovement({ travelled: 25, cost: 10 }),
    );

    expect(result).toBe(false);
  });

  test("counts further pending legs of a multi-leg path too", async () => {
    const actor = makeActor({ ground: 30 });
    setGame({ actor, mode: 'strict' });

    const result = await consumeForMovement(
      makeToken(actor), makeMovement({ travelled: 0, cost: 15, pendingCost: 20 }),
    );

    expect(result).toBe(false);
  });

  test("a teleport waypoint is still recognised in the passed path", async () => {
    const actor = makeActor();
    setGame({ actor });

    await consumeForMovement(makeToken(actor), makeMovement({ teleport: true }));

    expect(getRemaining(actor).move).toBe(1);
  });
});

describe("Pushing Yourself", () => {
  /* "Pushing Yourself: Buying Additional Movement" (GI Joe CRB p.194): each Free action spent with
     your Move action buys 5ft more, and you cannot buy past double your rating. Without this, a
     perfectly legal Push was reported as an overrun. */
  test("plans the Free actions a distance needs", () => {
    expect(planPush(30, 30, 3)).toMatchObject({ withinRating: true, freeNeeded: 0 });
    expect(planPush(40, 30, 3)).toMatchObject({ withinRating: false, pushFeet: 10, freeNeeded: 2, affordable: true, beyondCap: false });
    expect(planPush(35, 30, 0)).toMatchObject({ freeNeeded: 1, affordable: false });
    expect(planPush(70, 30, 99)).toMatchObject({ beyondCap: true, cap: 60 });
  });

  test("rounds a part-step up to a whole Free action", () => {
    // 3ft past the rating still costs the whole 5ft step.
    expect(planPush(33, 30, 3).freeNeeded).toBe(1);
  });

  test("buys the extra distance with Free actions and allows the move", async () => {
    const actor = makeActor({ ground: 30, free: 3 });
    setGame({ actor, mode: 'strict' });

    const result = await consumeForMovement(makeToken(actor), makeMovement({ cost: 40 }));

    expect(result).toBe(true);
    // One Move action, plus two Free actions for the extra 10ft.
    expect(getRemaining(actor).free).toBe(1);
    expect(getLedger(actor).log.filter(l => l.actionType === 'free')).toHaveLength(2);
    // A legal Push is an ordinary outcome - reported as info, never as a warning.
    expect(global.ui.notifications.info).toHaveBeenCalledWith('E20.ActionEconomyPushed');
    expect(global.ui.notifications.warn).not.toHaveBeenCalled();
  });

  test("refuses when the actor hasn't the Free actions to buy it", async () => {
    const actor = makeActor({ ground: 30, free: 1 });
    setGame({ actor, mode: 'strict' });

    // 40ft needs two Free actions; only one is available.
    expect(await consumeForMovement(makeToken(actor), makeMovement({ cost: 40 }))).toBe(false);
  });

  test("refuses past double the rating however many Free actions remain", async () => {
    const actor = makeActor({ ground: 30, free: 99 });
    setGame({ actor, mode: 'strict' });

    expect(await consumeForMovement(makeToken(actor), makeMovement({ cost: 70 }))).toBe(false);
  });

  test("allows exactly double the rating", async () => {
    const actor = makeActor({ ground: 30, free: 6 });
    setGame({ actor, mode: 'strict' });

    expect(await consumeForMovement(makeToken(actor), makeMovement({ cost: 60 }))).toBe(true);
  });

  test("counts a Push across a split move, not just the current leg", async () => {
    const actor = makeActor({ ground: 30, free: 3 });
    setGame({ actor, mode: 'strict' });

    // 25ft already walked plus 10ft now = 35ft: one Free action buys the last 5ft.
    expect(await consumeForMovement(makeToken(actor), makeMovement({ travelled: 25, cost: 10 }))).toBe(true);
    expect(getRemaining(actor).free).toBe(2);
  });
});

describe("every mode explains why a Push failed", () => {
  // The reason must survive into 'track', which is the default and blocks nothing: a bare
  // "past their Movement" line said nothing about Pushing and left the player guessing.
  test("past the doubling cap reports the cap, in track mode", async () => {
    const actor = makeActor({ ground: 30, free: 99 });
    setGame({ actor, mode: 'track' });

    await consumeForMovement(makeToken(actor), makeMovement({ cost: 70 }));

    expect(global.ui.notifications.warn)
      .toHaveBeenCalledWith('E20.ActionEconomyMovementCapped');
  });

  test("past the doubling cap reports the cap, in strict mode", async () => {
    const actor = makeActor({ ground: 30, free: 99 });
    setGame({ actor, mode: 'strict' });

    await consumeForMovement(makeToken(actor), makeMovement({ cost: 70 }));

    expect(global.ui.notifications.warn)
      .toHaveBeenCalledWith('E20.ActionEconomyMovementCapped');
  });

  test("being short of Free actions reports that instead", async () => {
    const actor = makeActor({ ground: 30, free: 0 });
    setGame({ actor, mode: 'strict' });

    await consumeForMovement(makeToken(actor), makeMovement({ cost: 40 }));

    expect(global.ui.notifications.warn)
      .toHaveBeenCalledWith('E20.ActionEconomyMovementUnaffordable');
  });
});

describe("getPushRules", () => {
  // The printed defaults: 5ft a Free action, capped at double the rating (GI Joe CRB p.194).
  const withPerk = (id, extra = {}) => ({
    type: 'playerCharacter',
    system: { ...extra },
    items: [{ type: 'perk', flags: { core: { sourceId: id } } }],
  });

  test("an ordinary character pushes 5ft a Free action, capped at double", () => {
    expect(getPushRules({ type: 'playerCharacter', system: {}, items: [] }))
      .toEqual({ feetPerFreeAction: 5, capMultiplier: 2, canPush: true });
  });

  test("survives an actor with nothing on it at all", () => {
    expect(getPushRules(undefined)).toEqual({ feetPerFreeAction: 5, capMultiplier: 2, canPush: true });
  });

  // Sewer Tunneler (Hawk's Personnel Files p.177) - 10ft a Free action, but still capped.
  test("Sewer Tunneler doubles the distance each Free action buys", () => {
    expect(getPushRules(withPerk('Compendium.essence20.general_hawk_s_personel_files.Item.gCbl6p64cEJjF2eJ')))
      .toEqual({ feetPerFreeAction: 10, capMultiplier: 2, canPush: true });
  });

  // Earlier is Better Than Later (TF CRB p.108) - both halves, but only in Alt Mode.
  test("Earlier is Better Than Later doubles the step AND lifts the cap, while transformed", () => {
    expect(getPushRules(withPerk('Compendium.essence20.tf_crb.Item.uyeLgTc55ixz31j1', { isTransformed: true })))
      .toEqual({ feetPerFreeAction: 10, capMultiplier: Infinity, canPush: true });
  });

  test("Earlier is Better Than Later does nothing in Bot Mode", () => {
    expect(getPushRules(withPerk('Compendium.essence20.tf_crb.Item.uyeLgTc55ixz31j1', { isTransformed: false })))
      .toEqual({ feetPerFreeAction: 5, capMultiplier: 2, canPush: true });
  });

  /* "vehicles with a driver can't use Standard actions to Sprint or Free actions to Push
     themselves" (Field Guide). An empty driver's seat leaves the vehicle able to Push. */
  test("a vehicle with a driver cannot Push at all", () => {
    const vehicle = {
      type: 'vehicle',
      system: { actors: { a: { uuid: 'Actor.1', vehicleRole: 'driver' } } },
      items: [],
    };

    expect(getPushRules(vehicle).canPush).toBe(false);
  });

  test("a vehicle with only passengers still pushes normally", () => {
    const vehicle = {
      type: 'vehicle',
      system: { actors: { a: { uuid: 'Actor.1', vehicleRole: 'passenger' } } },
      items: [],
    };

    expect(getPushRules(vehicle).canPush).toBe(true);
  });

  // The rule names driven vehicles; a piloted zord is deliberately left alone.
  test("a piloted zord is not treated as a driven vehicle", () => {
    const zord = {
      type: 'zord',
      system: { actors: { a: { uuid: 'Actor.1', vehicleRole: 'driver' } } },
      items: [],
    };

    expect(getPushRules(zord).canPush).toBe(true);
  });
});

describe("planPush with house rules applied", () => {
  const rules = (feetPerFreeAction, capMultiplier, canPush = true) =>
    ({ feetPerFreeAction, capMultiplier, canPush });

  test("a 10ft step halves the Free actions a given overrun costs", () => {
    expect(planPush(50, 30, 3, rules(10, 2)).freeNeeded).toBe(2);
    expect(planPush(50, 30, 3, rules(5, 2)).freeNeeded).toBe(4);
  });

  test("an uncapped actor is never beyond the cap, however far it goes", () => {
    const push = planPush(500, 30, 99, rules(10, Infinity));

    expect(push.beyondCap).toBe(false);
    expect(push.affordable).toBe(true);
  });

  // Not affordable at any price, which is what separates this from merely being short.
  test("an actor that cannot Push affords nothing, even with Free actions to spare", () => {
    const push = planPush(35, 30, 99, rules(5, 2, false));

    expect(push).toMatchObject({ withinRating: false, canPush: false, affordable: false });
  });

  test("an actor that cannot Push is still fine inside its own rating", () => {
    expect(planPush(30, 30, 0, rules(5, 2, false)).withinRating).toBe(true);
  });

  test("omitting the rules keeps the printed defaults", () => {
    expect(planPush(40, 30, 3)).toMatchObject({ freeNeeded: 2, cap: 60, canPush: true });
  });
});

/* Moving cancels an aim: the Aim shift holds "as long as you don't use Movement between your
   Aim and your attack" (GI Joe CRB p.193).

   Exercised through Essence20TokenDocument#_preUpdateMovement against the real
   consumeForMovement rather than a mock, because the whole question is what happens on the
   boundary between the two - a rejected move must not cost the aim, and only the real
   consumeForMovement decides when a move is rejected. */
describe("movement and aiming", () => {
  /**
   * A token document with the prototype under test, skipping the real constructor.
   */
  const makeTokenDocument = (actor) => Object.assign(
    Object.create(Essence20TokenDocument.prototype), { id: 'token1', actor },
  );

  test("a movement that goes through clears the aim", async () => {
    const actor = makeActor({ ground: 30 });
    setGame({ actor });
    await setAiming(actor, true);

    const allowed = await makeTokenDocument(actor)._preUpdateMovement(makeMovement({ cost: 10 }), {});

    expect(allowed).toBe(true);
    expect(isAiming(actor)).toBe(false);
  });

  /* The case the live canvas could not be made to exercise, and the one that matters: a move
     the world refused never happened, so it must not cost the aim. Without the guard, a player
     in a strict world loses their aim to a move they were not allowed to make. */
  test("a movement rejected in strict mode leaves the aim alone", async () => {
    const actor = makeActor({ ground: 30 });
    setGame({ actor, mode: 'strict' });
    await setAiming(actor, true);

    const allowed = await makeTokenDocument(actor)._preUpdateMovement(makeMovement({ cost: 45 }), {});

    expect(allowed).toBe(false);
    expect(isAiming(actor)).toBe(true);
  });

  // Out of combat there is no aim to clear and no ledger to write to, so this must not throw.
  test("a movement with no encounter running is harmless", async () => {
    const actor = makeActor({ ground: 30 });
    setGame({ actor: null });

    await expect(makeTokenDocument(actor)._preUpdateMovement(makeMovement(), {})).resolves.toBe(true);
  });
});

/* Sprint (GI Joe CRB p.197): "By taking a Standard action to Sprint, you may move up to double
   your full Movement."

   Both the drag ruler and the movement enforcement measure against getMovementAllowance, so
   doubling it there is what makes the two agree - these tests are as much about the Push cap
   moving with it as about the doubling itself. */
describe("Sprint", () => {
  test("doubles the allowance for the turn", async () => {
    const actor = makeActor({ ground: 30 });
    setGame({ actor });

    expect(getMovementAllowance(actor, 'ground')).toBe(30);
    await setSprinting(actor, true);
    expect(getMovementAllowance(actor, 'ground')).toBe(60);
  });

  test("leaves a movement type the actor does not have alone", async () => {
    const actor = makeActor({ ground: 30 });
    setGame({ actor });
    await setSprinting(actor, true);

    expect(getMovementAllowance(actor, 'swim')).toBeNull();
  });

  /* "A character cannot spend Free actions on buying additional Movement that would double one
     of their Movement Types" (p.193). The ceiling is on the BASE rating, so it must not move
     when Sprint doubles the allowance the multiplier is applied to - 2 x 30 either way. */
  test("the Push cap stays at twice the base rating", async () => {
    const actor = makeActor({ ground: 30, free: 4 });
    setGame({ actor });

    const walking = planPush(0, 30, 4, getPushRules(actor));
    await setSprinting(actor, true);
    const sprinting = planPush(0, getMovementAllowance(actor, 'ground'), 4, getPushRules(actor));

    expect(walking.cap).toBe(60);
    expect(sprinting.cap).toBe(60);
  });

  // Which in practice means a sprinting character is already at the ceiling and cannot Push.
  test("a sprinting character cannot Push past the doubled distance", async () => {
    const actor = makeActor({ ground: 30, free: 4 });
    setGame({ actor });
    await setSprinting(actor, true);

    const push = planPush(65, getMovementAllowance(actor, 'ground'), 4, getPushRules(actor));

    expect(push.beyondCap).toBe(true);
  });

  // 60ft on a 30ft rating is an ordinary sprint, not an overrun, so nothing is charged for it.
  test("moving twice the rating while sprinting costs no Free actions", async () => {
    const actor = makeActor({ ground: 30, free: 2 });
    setGame({ actor });
    await setSprinting(actor, true);

    expect(await consumeForMovement(makeToken(actor), makeMovement({ cost: 60 }))).toBe(true);
    expect(getRemaining(actor).free).toBe(2);
  });

  // The same 60ft without Sprinting is 30ft over, which costs six Free actions nobody has.
  test("the same distance without Sprinting is an overrun", async () => {
    const actor = makeActor({ ground: 30, free: 2 });
    setGame({ actor });

    await consumeForMovement(makeToken(actor), makeMovement({ cost: 60 }));

    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });

  // Earlier Is Better's "not limited" has to survive Sprinting, which is why the cap is divided
  // rather than assigned - Infinity / 2 is still Infinity.
  test("an uncapped actor stays uncapped while Sprinting", async () => {
    const actor = makeActor({ ground: 30 });
    setGame({ actor });
    await setSprinting(actor, true);

    const rules = getPushRules(actor);
    rules.capMultiplier = Infinity / 2;

    expect(planPush(500, 60, 0, rules).beyondCap).toBe(false);
  });

  test("is forgotten out of combat, where there is no ledger to hold it", async () => {
    const actor = makeActor({ ground: 30 });
    setGame({ actor: null });

    await setSprinting(actor, true);

    expect(getMovementAllowance(actor, 'ground')).toBe(30);
  });
});
