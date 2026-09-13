import { jest } from '@jest/globals';
import {
  activateLikeWaterOption, applyLikeWater, getAvailableLikeWaterOptions, getLikeWaterDefenseBonus, pickLikeWaterOption,
} from './like-water.mjs';

global.game = { i18n: { localize: jest.fn((key) => key) } };

function makeActor() {
  const flagStore = {};
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("getAvailableLikeWaterOptions", () => {
  test("both options available with nothing used yet", () => {
    expect(getAvailableLikeWaterOptions(makeActor())).toEqual(['toughness', 'evasion']);
  });

  test("only evasion once toughness is used", async () => {
    const actor = makeActor();
    await activateLikeWaterOption(actor, 'toughness');
    expect(getAvailableLikeWaterOptions(actor)).toEqual(['evasion']);
  });

  test("empty once both are used", async () => {
    const actor = makeActor();
    await activateLikeWaterOption(actor, 'toughness');
    await activateLikeWaterOption(actor, 'evasion');
    expect(getAvailableLikeWaterOptions(actor)).toEqual([]);
  });
});

describe("pickLikeWaterOption", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
  });

  test("returns the chosen option on confirm", async () => {
    waitMock.mockResolvedValue('evasion');
    expect(await pickLikeWaterOption(makeActor())).toBe('evasion');
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickLikeWaterOption(makeActor())).toBeNull();
  });

  test("returns null without opening a dialog when both options are already used", async () => {
    const actor = makeActor();
    await activateLikeWaterOption(actor, 'toughness');
    await activateLikeWaterOption(actor, 'evasion');

    expect(await pickLikeWaterOption(actor)).toBeNull();
    expect(waitMock).not.toHaveBeenCalled();
  });
});

describe("applyLikeWater", () => {
  test("activates the chosen option", async () => {
    const actor = makeActor();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('toughness') } } } };

    const result = await applyLikeWater(actor);

    expect(result).toBe('toughness');
    expect(getLikeWaterDefenseBonus(actor, 'toughness')).toBe(2);
  });

  test("returns null when cancelled", async () => {
    const actor = makeActor();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };

    expect(await applyLikeWater(actor)).toBeNull();
  });
});

describe("getLikeWaterDefenseBonus", () => {
  test("+2 Toughness once activated, not Evasion", async () => {
    const actor = makeActor();
    await activateLikeWaterOption(actor, 'toughness');

    expect(getLikeWaterDefenseBonus(actor, 'toughness')).toBe(2);
    expect(getLikeWaterDefenseBonus(actor, 'evasion')).toBe(0);
  });

  test("+2 Evasion once activated, not Toughness", async () => {
    const actor = makeActor();
    await activateLikeWaterOption(actor, 'evasion');

    expect(getLikeWaterDefenseBonus(actor, 'evasion')).toBe(2);
    expect(getLikeWaterDefenseBonus(actor, 'toughness')).toBe(0);
  });

  test("0 with nothing activated", () => {
    expect(getLikeWaterDefenseBonus(makeActor(), 'toughness')).toBe(0);
  });
});
