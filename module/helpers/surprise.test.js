import { jest } from '@jest/globals';
import {
  activateQuickAndQuiet, activateVoiceOfNightVale, getRallyingCryTargetLimit, isSurpriseRound,
} from './surprise.mjs';

describe("isSurpriseRound", () => {
  afterEach(() => {
    global.game = undefined;
  });

  test("true on the first round of an active combat", () => {
    global.game = { combat: { round: 1 } };
    expect(isSurpriseRound()).toBe(true);
  });

  test("false once the surprise round has passed", () => {
    global.game = { combat: { round: 2 } };
    expect(isSurpriseRound()).toBe(false);
  });

  test("false outside combat entirely", () => {
    global.game = {};
    expect(isSurpriseRound()).toBe(false);
  });
});

describe("activateQuickAndQuiet (Knights of Canterlot, Influence Perk, p.36)", () => {
  const first = jest.fn();

  beforeEach(() => {
    first.mockReset();
    global.game = { user: { targets: { first } }, i18n: { localize: key => key } };
    global.ui = { notifications: { warn: jest.fn() } };
  });

  afterEach(() => {
    global.game = undefined;
    global.ui = undefined;
  });

  // RAW is "without a Skill Test" - no roll, no contest, no cost.
  test("Surprises the targeted creature outright", async () => {
    const target = { name: 'Trixie', toggleStatusEffect: jest.fn() };
    first.mockReturnValue({ actor: target });

    expect(await activateQuickAndQuiet({ id: 'pony1' })).toBe(target);
    expect(target.toggleStatusEffect).toHaveBeenCalledWith('surprised', { active: true });
  });

  test("warns and Surprises nobody with no target", async () => {
    first.mockReturnValue(undefined);

    expect(await activateQuickAndQuiet({ id: 'pony1' })).toBe(null);
    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("activateVoiceOfNightVale (WTNV Citizens' Guide, General Perk, p.47)", () => {
  afterEach(() => {
    global.canvas = undefined;
  });

  test("targets nearby enemies and rolls Intimidation against their Willpower", async () => {
    const rollSkill = jest.fn();
    const setTargets = jest.fn();
    global.canvas = {
      tokens: {
        setTargets,
        placeables: [
          { id: 't1', actor: {}, center: { x: 0, y: 0 }, document: { disposition: -1 } },
          { id: 't2', actor: {}, center: { x: 10, y: 0 }, document: { disposition: -1 } },
        ],
      },
      grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) },
    };

    const actor = {
      id: 'citizen1',
      _dice: { rollSkill },
      token: { center: { x: 0, y: 0 }, document: { disposition: 1 } },
      getActiveTokens: () => [{ center: { x: 0, y: 0 }, document: { disposition: 1 } }],
    };

    await activateVoiceOfNightVale(actor);

    expect(setTargets).toHaveBeenCalledWith(['t1', 't2']);
    expect(rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'intimidation',
        essence: 'social',
        defenseType: 'willpower',
        isVoiceOfNightVale: true,
      }),
      actor,
    );
  });
});

describe("getRallyingCryTargetLimit", () => {
  // RAW: one enemy on a success, up to three on a Critical Success.
  test("is one on a plain success", () => {
    expect(getRallyingCryTargetLimit(false)).toBe(1);
  });

  test("is three on a Critical Success", () => {
    expect(getRallyingCryTargetLimit(true)).toBe(3);
  });
});
