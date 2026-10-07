import { jest } from '@jest/globals';
import {
  getCombineDie, getCombineReadyRound, isCombineReady, rollCombineTimer,
} from './combiner-timer.mjs';

const FAST_MODULATION_ID = "Compendium.essence20.pr_crb.Item.38bDkuZ73CmGBOSe";

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
  global.fromUuidSync.mockReset();
  game.combat = { started: true, round: 1 };
});
afterEach(() => {
  global.Roll = originalRoll;
  game.combat = null;
});

function makeZord(name, fastModulationCount = 0) {
  return {
    name,
    uuid: `Actor.${name}`,
    type: 'zord',
    items: Array.from({ length: fastModulationCount }, () => ({
      type: 'feature',
      flags: { core: { sourceId: FAST_MODULATION_ID } },
      // Its pack rule (rules/conv15-other.test.js checks it against the pack).
      system: { rules: [{ type: 'JoinDie', steps: 1, stacks: true }] },
    })),
  };
}

function makeMegaform(participants) {
  const flags = {};
  global.fromUuidSync.mockImplementation(uuid => participants.find(p => `Actor.${p.name}` === uuid) ?? null);

  return {
    name: 'Megazord',
    type: 'megaform',
    system: {
      subtype: ['megaformZord'],
      actors: Object.fromEntries(participants.map((p, i) => [`p${i}`, { uuid: `Actor.${p.name}` }])),
    },
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flags[key];
    }),
  };
}

describe("getCombineDie (Fast Modulation, PR CRB p.137)", () => {
  test("defaults to d6 with no Fast Modulation", () => {
    expect(getCombineDie(makeZord('Red'))).toBe('d6');
  });

  test("steps d6 -> d4 -> d2 as the Feature is taken repeatedly", () => {
    expect(getCombineDie(makeZord('Red', 1))).toBe('d4');
    expect(getCombineDie(makeZord('Red', 2))).toBe('d2');
  });

  test("past d2 it bottoms out at a flat 1, with no die left to roll", () => {
    expect(getCombineDie(makeZord('Red', 3))).toBeNull();
    expect(getCombineDie(makeZord('Red', 9))).toBeNull();
  });
});

describe("rollCombineTimer", () => {
  test("every participant rolls, and the highest sets the ready round", async () => {
    const megaform = makeMegaform([makeZord('Red'), makeZord('Blue'), makeZord('Black')]);
    rollTotals = [3, 7, 5];

    // round 1 + the highest roll (7)
    expect(await rollCombineTimer(megaform)).toBe(8);
    expect(megaform.setFlag).toHaveBeenCalledWith('essence20', 'combineReadyRound', 8);
  });

  test("a fully-reduced Zord contributes a flat 1 without rolling", async () => {
    const megaform = makeMegaform([makeZord('Red', 3)]);
    rollTotals = [];

    expect(await rollCombineTimer(megaform)).toBe(2); // round 1 + 1
  });

  test("clears the timer and rolls nothing outside of a started combat", async () => {
    game.combat = null;
    const megaform = makeMegaform([makeZord('Red')]);

    expect(await rollCombineTimer(megaform)).toBeNull();
    expect(megaform.unsetFlag).toHaveBeenCalledWith('essence20', 'combineReadyRound');
  });

  test("no participants means no timer", async () => {
    expect(await rollCombineTimer(makeMegaform([]))).toBeNull();
  });

  test("an actor with no subtype is left alone rather than throwing (drops must not break)", async () => {
    const bare = { system: { actors: {} } };
    expect(await rollCombineTimer(bare)).toBeNull();
  });
});

describe("rollCombineTimer counts from entering the fight, and never re-rolls (PR CRB p.139)", () => {
  test("a later drop rolls only for the new Zord; the earlier rolls stand", async () => {
    const red = makeZord('Red');
    const blue = makeZord('Blue');
    const megaform = makeMegaform([red]);
    rollTotals = [3];
    expect(await rollCombineTimer(megaform)).toBe(4);

    // Blue joins in round 3: only Blue rolls (2) - from the start of combat, so round 3, and Red's 4 stays the latest.
    game.combat.round = 3;
    megaform.system.actors.p1 = { uuid: 'Actor.Blue' };
    global.fromUuidSync.mockImplementation(uuid => [red, blue].find(p => `Actor.${p.name}` === uuid) ?? null);
    rollTotals = [2];
    expect(await rollCombineTimer(megaform)).toBe(4);
    expect(rollTotals).toEqual([]);
  });

  test("a Zord that was summoned counts from its arrival round", async () => {
    const late = { ...makeZord('Late'), getFlag: (scope, key) => (key == 'zordSummonReadyRound' ? 5 : undefined) };
    const megaform = makeMegaform([late]);
    rollTotals = [3];
    expect(await rollCombineTimer(megaform)).toBe(8);
  });

  test("a Transformers Combiner has no timer", async () => {
    const megaform = makeMegaform([makeZord('Red')]);
    megaform.system.subtype = ['megaformCombiner'];
    expect(await rollCombineTimer(megaform)).toBeNull();
  });
});

describe("isCombineReady", () => {
  test("false before the rolled round, true once reached", async () => {
    const megaform = makeMegaform([makeZord('Red')]);
    rollTotals = [4];
    await rollCombineTimer(megaform); // ready at round 5

    game.combat.round = 4;
    expect(isCombineReady(megaform)).toBe(false);

    game.combat.round = 5;
    expect(isCombineReady(megaform)).toBe(true);
  });

  test("true when no timer is running at all", () => {
    expect(isCombineReady(makeMegaform([]))).toBe(true);
    expect(getCombineReadyRound(makeMegaform([]))).toBeNull();
  });
});
