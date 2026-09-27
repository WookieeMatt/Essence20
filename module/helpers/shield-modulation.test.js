import { jest } from '@jest/globals';
import {
  getShieldModulationDamageType, isProtectedByShieldModulation, needsShieldModulationChoice,
  pickShieldModulationDamageType, setShieldModulationDamageType,
} from './shield-modulation.mjs';

const PERSONAL_SHIELD_ROLE_POINTS_ID = "Compendium.essence20.gi_joe_crb.Item.84JYgd6kZgY41wge";
const SHIELD_MODULATION_ID = "Compendium.essence20.gi_joe_crb.Item.16ul4Ev6b9gO5CIN";
const SHIELD_UPGRADE_ID = "Compendium.essence20.gi_joe_crb.Item.ep0OFsU1QIuRpHeR";

global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

function makeActor({ hasPerk = true } = {}) {
  const items = hasPerk ? [{ type: 'perk', flags: { core: { sourceId: SHIELD_MODULATION_ID } } }] : [];
  return { items, getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
}

function makeShieldItem() {
  return { flags: { core: { sourceId: PERSONAL_SHIELD_ROLE_POINTS_ID } } };
}

describe("needsShieldModulationChoice", () => {
  test("true for the Personal Shield item with the Perk", () => {
    expect(needsShieldModulationChoice(makeActor(), makeShieldItem())).toBe(true);
  });

  test("false without the Perk", () => {
    expect(needsShieldModulationChoice(makeActor({ hasPerk: false }), makeShieldItem())).toBe(false);
  });

  test("false for some other Role Points item, even with the Perk", () => {
    const otherItem = { flags: { core: { sourceId: "Compendium.essence20.gi_joe_crb.Item.other" } } };
    expect(needsShieldModulationChoice(makeActor(), otherItem)).toBe(false);
  });
});

describe("pickShieldModulationDamageType", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("returns the chosen damage type", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('poison');
    expect(await pickShieldModulationDamageType()).toBe('poison');
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickShieldModulationDamageType()).toBe(null);
  });
});

describe("setShieldModulationDamageType / getShieldModulationDamageType", () => {
  test("stores and reads back the chosen damage type", async () => {
    const actor = makeActor();

    await setShieldModulationDamageType(actor, 'sonic');

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'shieldModulationDamageType', 'sonic');
  });

  test("reads back a stored value", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn(() => 'sonic');

    expect(getShieldModulationDamageType(actor)).toBe('sonic');
  });

  test("returns null with nothing stored", () => {
    expect(getShieldModulationDamageType(makeActor())).toBe(null);
  });
});

describe("isProtectedByShieldModulation", () => {
  function makeToken({ actor, disposition = 1 } = {}) {
    return { actor, document: { disposition }, center: {} };
  }

  function makeModulator({
    isActive = true, damageType = 'fire', hasPerk = true, hasShieldUpgrade = true,
  } = {}) {
    const items = [
      ...(hasPerk ? [{ type: 'perk', flags: { core: { sourceId: SHIELD_MODULATION_ID } } }] : []),
      ...(hasShieldUpgrade ? [{ type: 'perk', flags: { core: { sourceId: SHIELD_UPGRADE_ID } } }] : []),
    ];

    return {
      items,
      _getBaseRolePoints: jest.fn(() => ({
        flags: { core: { sourceId: PERSONAL_SHIELD_ROLE_POINTS_ID } },
        system: { isActive },
      })),
      getFlag: jest.fn(() => damageType),
    };
  }

  beforeEach(() => {
    canvas.tokens.placeables = [];
    canvas.grid.measurePath.mockReturnValue({ distance: 0 });
  });

  test("true for the holder's own matching-modulated active shield", () => {
    const target = makeModulator({ damageType: 'fire' });
    target.getActiveTokens = jest.fn(() => [makeToken({ actor: target })]);

    expect(isProtectedByShieldModulation(target, 'fire')).toBe(true);
  });

  test("false for the holder when the damage type doesn't match", () => {
    const target = makeModulator({ damageType: 'fire' });
    target.getActiveTokens = jest.fn(() => [makeToken({ actor: target })]);

    expect(isProtectedByShieldModulation(target, 'sonic')).toBe(false);
  });

  test("extends to a nearby ally within 10 feet once Shield Upgrade is also held", () => {
    const targetToken = makeToken();
    const target = { getActiveTokens: jest.fn(() => [targetToken]) };
    targetToken.actor = target;
    const modulator = makeModulator({ damageType: 'fire' });
    canvas.tokens.placeables = [targetToken, makeToken({ actor: modulator })];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(isProtectedByShieldModulation(target, 'fire')).toBe(true);
  });

  test("doesn't extend beyond 10 feet", () => {
    const targetToken = makeToken();
    const target = { getActiveTokens: jest.fn(() => [targetToken]) };
    targetToken.actor = target;
    const modulator = makeModulator({ damageType: 'fire' });
    canvas.tokens.placeables = [targetToken, makeToken({ actor: modulator })];
    canvas.grid.measurePath.mockReturnValue({ distance: 11 });

    expect(isProtectedByShieldModulation(target, 'fire')).toBe(false);
  });

  test("doesn't extend without the nearby ally also holding Shield Upgrade", () => {
    const targetToken = makeToken();
    const target = { getActiveTokens: jest.fn(() => [targetToken]) };
    targetToken.actor = target;
    const modulator = makeModulator({ damageType: 'fire', hasShieldUpgrade: false });
    canvas.tokens.placeables = [targetToken, makeToken({ actor: modulator })];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(isProtectedByShieldModulation(target, 'fire')).toBe(false);
  });

  test("doesn't extend to a hostile token", () => {
    const targetToken = makeToken(({ disposition: 1 }));
    const target = { getActiveTokens: jest.fn(() => [targetToken]) };
    targetToken.actor = target;
    const modulator = makeModulator({ damageType: 'fire' });
    canvas.tokens.placeables = [targetToken, makeToken({ actor: modulator, disposition: -1 })];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(isProtectedByShieldModulation(target, 'fire')).toBe(false);
  });

  test("false when the actor has no token on the scene and isn't the holder", () => {
    const target = { getActiveTokens: jest.fn(() => []) };
    expect(isProtectedByShieldModulation(target, 'fire')).toBe(false);
  });
});
