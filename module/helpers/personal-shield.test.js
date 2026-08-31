import { jest } from '@jest/globals';
import { getShieldUpgradeBonus, isPersonalShieldActive } from './personal-shield.mjs';

const PERSONAL_SHIELD_ROLE_POINTS_ID = "Compendium.essence20.gi_joe_crb.Item.84JYgd6kZgY41wge";
const SHIELD_UPGRADE_ID = "Compendium.essence20.gi_joe_crb.Item.ep0OFsU1QIuRpHeR";

global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

describe("getShieldUpgradeBonus", () => {
  function makeToken({ actor, disposition = 1 } = {}) {
    return { actor, document: { disposition }, center: {} };
  }

  function makeVanguard({ isActive = true, value = 3, hasShieldUpgrade = true, coversDefense = true } = {}) {
    const items = hasShieldUpgrade
      ? [{ type: 'perk', flags: { core: { sourceId: SHIELD_UPGRADE_ID } } }]
      : [];

    return {
      items,
      _getBaseRolePoints: jest.fn(() => ({
        flags: { core: { sourceId: PERSONAL_SHIELD_ROLE_POINTS_ID } },
        system: {
          isActive,
          bonus: {
            type: 'defenseBonus',
            value,
            defenseBonus: { toughness: coversDefense, evasion: coversDefense },
          },
        },
      })),
    };
  }

  function makeTarget(disposition = 1) {
    const token = makeToken({ disposition });
    const actor = { getActiveTokens: jest.fn(() => [token]) };
    token.actor = actor;
    return { actor, token };
  }

  beforeEach(() => {
    canvas.tokens.placeables = [];
    canvas.grid.measurePath.mockReturnValue({ distance: 0 });
  });

  test("applies the nearby active-shielded Vanguard's bonus", () => {
    const { actor: targetActor, token: targetToken } = makeTarget();
    const vanguardToken = makeToken({ actor: makeVanguard({ value: 3 }) });
    canvas.tokens.placeables = [targetToken, vanguardToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getShieldUpgradeBonus(targetActor, 'toughness')).toBe(3);
  });

  test("doesn't apply beyond 10 feet", () => {
    const { actor: targetActor, token: targetToken } = makeTarget();
    const vanguardToken = makeToken({ actor: makeVanguard({ value: 3 }) });
    canvas.tokens.placeables = [targetToken, vanguardToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 11 });

    expect(getShieldUpgradeBonus(targetActor, 'toughness')).toBe(0);
  });

  test("doesn't apply when the Vanguard's shield isn't active", () => {
    const { actor: targetActor, token: targetToken } = makeTarget();
    const vanguardToken = makeToken({ actor: makeVanguard({ isActive: false }) });
    canvas.tokens.placeables = [targetToken, vanguardToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getShieldUpgradeBonus(targetActor, 'toughness')).toBe(0);
  });

  test("doesn't apply without the Shield Upgrade Perk", () => {
    const { actor: targetActor, token: targetToken } = makeTarget();
    const vanguardToken = makeToken({ actor: makeVanguard({ hasShieldUpgrade: false }) });
    canvas.tokens.placeables = [targetToken, vanguardToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getShieldUpgradeBonus(targetActor, 'toughness')).toBe(0);
  });

  test("doesn't apply to a hostile token (not an ally)", () => {
    const { actor: targetActor, token: targetToken } = makeTarget(1);
    const vanguardToken = makeToken({ actor: makeVanguard(), disposition: -1 });
    canvas.tokens.placeables = [targetToken, vanguardToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getShieldUpgradeBonus(targetActor, 'toughness')).toBe(0);
  });

  test("doesn't apply to a defense type the shield's own bonus doesn't cover", () => {
    const { actor: targetActor, token: targetToken } = makeTarget();
    const vanguardToken = makeToken({ actor: makeVanguard({ coversDefense: false }) });
    canvas.tokens.placeables = [targetToken, vanguardToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getShieldUpgradeBonus(targetActor, 'toughness')).toBe(0);
  });

  test("doesn't apply to a non-Toughness/Evasion defense type", () => {
    const { actor: targetActor, token: targetToken } = makeTarget();
    const vanguardToken = makeToken({ actor: makeVanguard() });
    canvas.tokens.placeables = [targetToken, vanguardToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getShieldUpgradeBonus(targetActor, 'willpower')).toBe(0);
  });

  test("ignores the target's own token in the scan", () => {
    const { actor: targetActor, token: targetToken } = makeTarget();
    canvas.tokens.placeables = [targetToken];

    expect(getShieldUpgradeBonus(targetActor, 'toughness')).toBe(0);
  });

  test("takes the highest bonus when multiple Shield-Upgraded allies are in range", () => {
    const { actor: targetActor, token: targetToken } = makeTarget();
    const weaker = makeToken({ actor: makeVanguard({ value: 2 }) });
    const stronger = makeToken({ actor: makeVanguard({ value: 5 }) });
    canvas.tokens.placeables = [targetToken, weaker, stronger];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getShieldUpgradeBonus(targetActor, 'toughness')).toBe(5);
  });

  test("returns 0 when the actor has no token on the scene", () => {
    const actor = { getActiveTokens: jest.fn(() => []) };
    expect(getShieldUpgradeBonus(actor, 'toughness')).toBe(0);
  });
});

describe("isPersonalShieldActive", () => {
  test("true for an active Personal Shield", () => {
    const actor = {
      _getBaseRolePoints: jest.fn(() => ({
        flags: { core: { sourceId: PERSONAL_SHIELD_ROLE_POINTS_ID } },
        system: { isActive: true },
      })),
    };

    expect(isPersonalShieldActive(actor)).toBe(true);
  });

  test("false when the shield is present but not Active", () => {
    const actor = {
      _getBaseRolePoints: jest.fn(() => ({
        flags: { core: { sourceId: PERSONAL_SHIELD_ROLE_POINTS_ID } },
        system: { isActive: false },
      })),
    };

    expect(isPersonalShieldActive(actor)).toBe(false);
  });

  test("false for some other Role's defenseBonus Role Points Item", () => {
    const actor = {
      _getBaseRolePoints: jest.fn(() => ({
        flags: { core: { sourceId: "Compendium.essence20.gi_joe_crb.Item.other" } },
        system: { isActive: true },
      })),
    };

    expect(isPersonalShieldActive(actor)).toBe(false);
  });

  test("false when the actor has no base Role Points at all", () => {
    const actor = { _getBaseRolePoints: jest.fn(() => null) };
    expect(isPersonalShieldActive(actor)).toBe(false);
  });
});
