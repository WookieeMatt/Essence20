import { jest } from '@jest/globals';
import {
  applyLikeWater, getAvailableLikeWaterOptions, getLikeWaterDefenseBonus, pickLikeWaterOption,
} from './like-water.mjs';

// Used/active this Combat: stamped with the current (default 1) encounter on the Scene Clock.
const USED = { epoch: 1, window: 'encounter', count: 1 };

function makeActor(flags = {}) {
  return {
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
  };
}

describe("getAvailableLikeWaterOptions", () => {
  test("both options available when neither has been activated", () => {
    expect(getAvailableLikeWaterOptions(makeActor())).toEqual(['toughness', 'evasion']);
  });

  test("excludes an option once it's been activated this Combat", () => {
    expect(getAvailableLikeWaterOptions(makeActor({ likeWaterToughnessActive: USED }))).toEqual(['evasion']);
    expect(getAvailableLikeWaterOptions(makeActor({ likeWaterEvasionActive: USED }))).toEqual(['toughness']);
  });

  test("empty once both have been activated", () => {
    expect(getAvailableLikeWaterOptions(
      makeActor({ likeWaterToughnessActive: USED, likeWaterEvasionActive: USED }),
    )).toEqual([]);
  });
});

describe("pickLikeWaterOption", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.game = { i18n: { localize: jest.fn((key) => key) } };
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
  });

  test("returns the chosen option on confirm", async () => {
    waitMock.mockResolvedValue('toughness');
    expect(await pickLikeWaterOption(['toughness', 'evasion'])).toBe('toughness');
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickLikeWaterOption(['toughness', 'evasion'])).toBeNull();
  });
});

describe("applyLikeWater", () => {
  beforeEach(() => {
    global.game = { i18n: { localize: jest.fn((key) => key) } };
  });

  test("skips the picker and activates the sole remaining option directly", async () => {
    const actor = makeActor({ likeWaterToughnessActive: USED });

    const result = await applyLikeWater(actor);

    expect(result).toBe('evasion');
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'likeWaterEvasionActive', USED);
  });

  test("prompts when both options are available and activates the chosen one", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('toughness') } } } };
    const actor = makeActor();

    const result = await applyLikeWater(actor);

    expect(result).toBe('toughness');
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'likeWaterToughnessActive', USED);
  });

  test("returns null with nothing left to activate", async () => {
    const actor = makeActor({ likeWaterToughnessActive: USED, likeWaterEvasionActive: USED });
    expect(await applyLikeWater(actor)).toBeNull();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("returns null when the picker is cancelled", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };
    const actor = makeActor();

    expect(await applyLikeWater(actor)).toBeNull();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("getLikeWaterDefenseBonus", () => {
  test("+2 for an active Defense, 0 otherwise", () => {
    const actor = makeActor({ likeWaterToughnessActive: USED });
    expect(getLikeWaterDefenseBonus(actor, 'toughness')).toBe(2);
    expect(getLikeWaterDefenseBonus(actor, 'evasion')).toBe(0);
  });

  test("0 for a Defense Like Water doesn't cover, with nothing active, or with no actor", () => {
    expect(getLikeWaterDefenseBonus(makeActor({ likeWaterToughnessActive: USED }), 'willpower')).toBe(0);
    expect(getLikeWaterDefenseBonus(makeActor(), 'toughness')).toBe(0);
    expect(getLikeWaterDefenseBonus(null, 'toughness')).toBe(0);
  });
});

describe("Like Water's until-end-of-Combat duration", () => {
  test("a use from an earlier encounter neither grants the +2 nor blocks a new use", () => {
    const actor = makeActor({ likeWaterToughnessActive: { ...USED, epoch: 0 } });
    expect(getLikeWaterDefenseBonus(actor, 'toughness')).toBe(0);
    expect(getAvailableLikeWaterOptions(actor)).toEqual(['toughness', 'evasion']);
  });

  test("a leftover plain-true flag from before it had a duration reads as expired", () => {
    const actor = makeActor({ likeWaterEvasionActive: true });
    expect(getLikeWaterDefenseBonus(actor, 'evasion')).toBe(0);
    expect(getAvailableLikeWaterOptions(actor)).toEqual(['toughness', 'evasion']);
  });
});
