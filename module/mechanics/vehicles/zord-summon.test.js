import { jest } from '@jest/globals';
import {
  getSummonReadyRound, isSummonReady, onSummonZord, rollSummonTimer,
} from './zord-summon.mjs';

const ENHANCED_SUMMONER_ID = "Compendium.essence20.pr_crb.Item.pmA5wQDbc5oQk5Ak";

let rollTotals = [];
let originalRoll;
beforeEach(() => {
  rollTotals = [];
  originalRoll = global.Roll;
  global.Roll = class {
    constructor(formula) {
      this.formula = formula;
    }
    async evaluate() {
      this.total = rollTotals.length ? rollTotals.shift() : 0;
      return this;
    }
  };
  ChatMessage.create.mockClear();
  global.fromUuid.mockReset();
  game.combat = { started: true, round: 1 };
  global.canvas = { tokens: { placeables: [] } };
});
afterEach(() => {
  global.Roll = originalRoll;
  game.combat = null;
  global.canvas = undefined;
});

function makePilot(perkIds = []) {
  return { items: perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } })) };
}

function makeZord() {
  const flags = {};
  return {
    name: 'Red Dragon Thunderzord',
    type: 'zord',
    getFlag: jest.fn((scope, key) => flags[key] ?? null),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flags[key];
    }),
  };
}

describe("rollSummonTimer (Call to Action, PR CRB p.136-137)", () => {
  test("rolls 3d2 and stores round + total as an absolute ready round", async () => {
    const zord = makeZord();
    rollTotals = [4];

    expect(await rollSummonTimer(makePilot(), zord)).toBe(5); // round 1 + 4
    expect(zord.setFlag).toHaveBeenCalledWith('essence20', 'zordSummonReadyRound', 5);
    expect(ChatMessage.create).toHaveBeenCalled();
  });

  test("Enhanced Summoner reduces the total by 1", async () => {
    const zord = makeZord();
    rollTotals = [4];

    expect(await rollSummonTimer(makePilot([ENHANCED_SUMMONER_ID]), zord)).toBe(4); // round 1 + (4-1)
  });

  test("Enhanced Summoner never reduces below a minimum of 1 round", async () => {
    const zord = makeZord();
    rollTotals = [1];

    expect(await rollSummonTimer(makePilot([ENHANCED_SUMMONER_ID]), zord)).toBe(2); // round 1 + max(1, 1-1)
  });

  test("a nearby ally holding Enhanced Summoner also reduces the roll (team-wide grant)", async () => {
    const pilot = makePilot();
    const pilotToken = { document: { disposition: 1 } };
    pilot.getActiveTokens = () => [pilotToken];
    const allyToken = { actor: makePilot([ENHANCED_SUMMONER_ID]), document: { disposition: 1 } };
    global.canvas = { tokens: { placeables: [pilotToken, allyToken] } };

    const zord = makeZord();
    rollTotals = [4];
    expect(await rollSummonTimer(pilot, zord)).toBe(4);
  });

  test("clears the timer and rolls nothing outside of a started combat", async () => {
    game.combat = null;
    const zord = makeZord();

    expect(await rollSummonTimer(makePilot(), zord)).toBeNull();
    expect(zord.unsetFlag).toHaveBeenCalledWith('essence20', 'zordSummonReadyRound');
  });

  test("null for a non-Zord actor", async () => {
    expect(await rollSummonTimer(makePilot(), { type: 'vehicle' })).toBeNull();
  });
});

describe("isSummonReady / getSummonReadyRound", () => {
  test("false before the rolled round, true once reached", async () => {
    const zord = makeZord();
    rollTotals = [3];
    await rollSummonTimer(makePilot(), zord); // ready at round 4

    game.combat.round = 3;
    expect(isSummonReady(zord)).toBe(false);

    game.combat.round = 4;
    expect(isSummonReady(zord)).toBe(true);
  });

  test("true when no timer is running at all", () => {
    expect(isSummonReady(makeZord())).toBe(true);
    expect(getSummonReadyRound(makeZord())).toBeNull();
  });
});

describe("onSummonZord (sheet-action entry point)", () => {
  test("resolves the clicked card's uuid via fromUuid and rolls its timer", async () => {
    const zord = makeZord();
    global.fromUuid.mockResolvedValueOnce(zord);
    rollTotals = [5];

    const target = { dataset: { systemActorsUuid: 'Actor.zord1' } };
    await onSummonZord(target, makePilot());

    expect(global.fromUuid).toHaveBeenCalledWith('Actor.zord1');
    expect(zord.setFlag).toHaveBeenCalledWith('essence20', 'zordSummonReadyRound', 6);
  });

  test("no-ops with no uuid on the clicked target", async () => {
    await onSummonZord({ dataset: {} }, makePilot());
    expect(global.fromUuid).not.toHaveBeenCalled();
  });
});
