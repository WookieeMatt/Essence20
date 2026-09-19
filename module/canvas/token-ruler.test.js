import { jest } from '@jest/globals';

/**
 * TokenRuler lives under foundry.canvas.placeables.tokens and is read at import time, so the stub
 * has to exist before the module loads - hence the dynamic import.
 */
global.foundry = {
  ...(global.foundry ?? {}),
  canvas: { placeables: { tokens: { TokenRuler: class TokenRuler {
    _getWaypointLabelContext() {
      return { cssClass: 'last planned' };
    }

    _getSegmentStyle() {
      return { width: 4, color: 0x111111, alpha: 1 };
    }

    _getGridHighlightStyle() {
      return { color: 0x111111, alpha: 0.5 };
    }
  } } } },
  utils: { randomID: () => 'id1' },
};

if (!String.prototype.capitalize) {
  Object.defineProperty(String.prototype, 'capitalize', {
    value: function capitalize() {
      return this.charAt(0).toUpperCase() + this.slice(1);
    },
    configurable: true,
    writable: true,
  });
}

const { Essence20TokenRuler } = await import('./token-ruler.mjs');

function makeActor({ enabled = true, ground = 30, free = 0 } = {}) {
  return {
    name: 'Duke',
    token: { id: 'token1' },
    system: {
      actions: {
        enabled,
        shared: false,
        standard: { base: 1, bonus: 0, max: 1 },
        move: { base: 1, bonus: 0, max: 1 },
        free: { base: free, bonus: 0, max: free },
      },
      movement: { ground: { total: ground } },
    },
  };
}

function makeRuler(actor, { tokenId = 'token1', history = [] } = {}) {
  const ruler = new Essence20TokenRuler();
  ruler.token = { actor, document: { id: tokenId, movementHistory: history } };
  return ruler;
}

function setGame({ actor, turnTokenId = 'token1', mode = 'track', movementOn = true } = {}) {
  global.game = {
    user: { isGM: false },
    i18n: { format: jest.fn((key, data) => `${key}:${JSON.stringify(data)}`), localize: jest.fn(k => k) },
    settings: {
      get: jest.fn((scope, key) => {
        if (key === 'actionEconomyMode') return mode;
        if (key === 'actionEconomyMovement') return movementOn;
        return undefined;
      }),
    },
    combat: actor
      ? { combatant: { tokenId: turnTokenId }, getCombatantsByActor: () => [] }
      : null,
  };
}

const waypoint = (cost, action = 'walk') => ({ action, measurement: { cost } });

describe("_getPushContext", () => {
  test("says nothing for a move within the rating", () => {
    const actor = makeActor();
    setGame({ actor });

    expect(makeRuler(actor)._getPushContext(waypoint(30))).toBeNull();
  });

  test("reports the Free actions an affordable Push costs", () => {
    const actor = makeActor({ free: 3 });
    setGame({ actor });

    const push = makeRuler(actor)._getPushContext(waypoint(40));

    expect(push).toMatchObject({ status: 'pushing', feet: 40, free: 2 });
  });

  test("distinguishes not-enough-Free from past-the-cap", () => {
    const short = makeActor({ free: 0 });
    setGame({ actor: short });
    expect(makeRuler(short)._getPushContext(waypoint(40)).status).toBe('unaffordable');

    const rich = makeActor({ free: 99 });
    setGame({ actor: rich });
    expect(makeRuler(rich)._getPushContext(waypoint(70))).toMatchObject({ status: 'capped', cap: 60 });
  });

  // Core measures history-then-planned as one path, so the waypoint cost already covers distance
  // walked earlier in the turn. Adding the history on top of it double-counted every later move.
  test("does not re-count distance already recorded this turn", () => {
    const actor = makeActor({ free: 3 });
    setGame({ actor });

    const ruler = makeRuler(actor, { history: [{ cost: 20 }, { cost: 5 }] });

    expect(ruler._getPushContext(waypoint(30))).toBeNull();
    expect(ruler._getPushContext(waypoint(40))).toMatchObject({ feet: 40, free: 2 });
  });

  test("says nothing on another combatant's turn", () => {
    const actor = makeActor({ free: 3 });
    setGame({ actor, turnTokenId: 'someoneElse' });

    expect(makeRuler(actor)._getPushContext(waypoint(40))).toBeNull();
  });

  test("says nothing out of combat, with tracking off, or for an opted-out actor", () => {
    const actor = makeActor({ free: 3 });

    setGame({ actor: null });
    expect(makeRuler(actor)._getPushContext(waypoint(40))).toBeNull();

    setGame({ actor, mode: 'off' });
    expect(makeRuler(actor)._getPushContext(waypoint(40))).toBeNull();

    setGame({ actor, movementOn: false });
    expect(makeRuler(actor)._getPushContext(waypoint(40))).toBeNull();

    const optedOut = makeActor({ enabled: false });
    setGame({ actor: optedOut });
    expect(makeRuler(optedOut)._getPushContext(waypoint(40))).toBeNull();
  });

  test("says nothing for a teleport, which is not movement", () => {
    const actor = makeActor({ free: 3 });
    setGame({ actor });

    expect(makeRuler(actor)._getPushContext(waypoint(40, 'blink'))).toBeNull();
  });
});

describe("_getWaypointLabelContext", () => {
  test("tags the label so the note can be coloured by severity", () => {
    const actor = makeActor({ free: 3 });
    setGame({ actor });

    const context = makeRuler(actor)._getWaypointLabelContext(waypoint(40), {});

    expect(context.cssClass).toContain('e20-push--pushing');
    expect(context.e20Push.status).toBe('pushing');
  });

  test("leaves an ordinary label untouched", () => {
    const actor = makeActor();
    setGame({ actor });

    const context = makeRuler(actor)._getWaypointLabelContext(waypoint(10), {});

    expect(context.cssClass).toBe('last planned');
    expect(context.e20Push).toBeUndefined();
  });
});

describe("path colouring", () => {
  const GREEN = 0x46b478;
  const AMBER = 0xffc861;
  const RED = 0xff5c4d;

  test.each([
    ['within the rating', 30, 3, GREEN],
    ['Pushing with Free actions to spare', 40, 3, AMBER],
    ['short of Free actions', 40, 0, RED],
    ['past the doubling cap', 70, 99, RED],
  ])('colours the line %s', (label, cost, free, expected) => {
    const actor = makeActor({ free });
    setGame({ actor });

    expect(makeRuler(actor)._getSegmentStyle(waypoint(cost)).color).toBe(expected);
  });

  test("colours the grid squares to match the line", () => {
    const actor = makeActor({ free: 3 });
    setGame({ actor });

    expect(makeRuler(actor)._getGridHighlightStyle(waypoint(40), {}).color).toBe(AMBER);
  });

  // One drag can cross both thresholds; each waypoint carries the cumulative cost, so the segments
  // change colour at the exact step where the rating, then the cap, runs out.
  test("changes colour partway along a single path", () => {
    const actor = makeActor({ free: 2 });
    setGame({ actor });
    const ruler = makeRuler(actor);

    // 30ft rating, 2 Free actions: green to 30, amber to 40 (2 Free buy 10ft), red past that.
    const colors = [10, 25, 35, 40, 80].map(c => ruler._getSegmentStyle(waypoint(c)).color);

    expect(colors).toEqual([GREEN, GREEN, AMBER, AMBER, RED]);
  });

  test("keeps core's own width and alpha", () => {
    const actor = makeActor({ free: 3 });
    setGame({ actor });

    expect(makeRuler(actor)._getSegmentStyle(waypoint(40))).toMatchObject({ width: 4, alpha: 1 });
  });

  test("leaves core's colour alone when the economy doesn't apply", () => {
    const actor = makeActor();
    setGame({ actor, turnTokenId: 'someoneElse' });

    expect(makeRuler(actor)._getSegmentStyle(waypoint(40)).color).toBe(0x111111);
  });

  // Core hides squares it does not want drawn; recolouring those would put them back on screen.
  test("does not revive a grid square core chose to hide", () => {
    const actor = makeActor({ free: 3 });
    setGame({ actor });
    const ruler = makeRuler(actor);
    const base = Object.getPrototypeOf(Essence20TokenRuler.prototype);
    const hidden = jest.spyOn(base, "_getGridHighlightStyle").mockReturnValue({ alpha: 0 });

    expect(ruler._getGridHighlightStyle(waypoint(40), {})).toEqual({ alpha: 0 });

    hidden.mockRestore();
  });
});

// Core returns {width: 0} and no colour for an action it does not visualize. Colouring that would
// be inventing a colour for a line core has decided not to draw.
test("does not colour a segment core chose not to draw", () => {
  const actor = makeActor({ free: 3 });
  setGame({ actor });
  const ruler = makeRuler(actor);
  const base = Object.getPrototypeOf(Essence20TokenRuler.prototype);
  const invisible = jest.spyOn(base, '_getSegmentStyle').mockReturnValue({ width: 0 });

  expect(ruler._getSegmentStyle(waypoint(40))).toEqual({ width: 0 });

  invisible.mockRestore();
});

test("says how many Free actions are actually left when the Push is unaffordable", () => {
  const actor = makeActor({ free: 2 });
  setGame({ actor });

  expect(makeRuler(actor)._getPushContext(waypoint(50))).toMatchObject({ free: 4, freeLeft: 2 });
});

// A driven vehicle cannot Push at all (Field Guide), so the path is red for a reason neither
// "short of Free actions" nor "past the cap" describes.
describe("a token that cannot Push", () => {
  function setVehicle(ground = 30) {
    const actor = {
      name: 'Rhino',
      type: 'vehicle',
      token: { id: 'token1' },
      items: [],
      system: {
        actions: {
          enabled: true,
          shared: false,
          standard: { base: 1, bonus: 0, max: 1 },
          move: { base: 1, bonus: 0, max: 1 },
          free: { base: 9, bonus: 0, max: 9 },
        },
        actors: { a: { uuid: 'Actor.1', vehicleRole: 'driver' } },
        movement: { ground: { total: ground } },
      },
    };
    setGame({ actor });
    return actor;
  }

  test("is red past its rating, even with Free actions to spare", () => {
    const actor = setVehicle();

    expect(makeRuler(actor)._getSegmentStyle(waypoint(35)).color).toBe(0xff5c4d);
  });

  test("says it cannot Push, rather than quoting a cap or a shortfall", () => {
    const actor = setVehicle();

    expect(makeRuler(actor)._getPushContext(waypoint(35)).status).toBe('noPush');
  });

  test("is still green inside its own rating", () => {
    const actor = setVehicle();

    expect(makeRuler(actor)._getSegmentStyle(waypoint(30)).color).toBe(0x46b478);
  });
});
