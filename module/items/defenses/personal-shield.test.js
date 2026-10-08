import { jest } from '@jest/globals';
import { applyProtectorsShieldHealthBonus, isPersonalShieldActive } from './personal-shield.mjs';

const PERSONAL_SHIELD_ROLE_POINTS_ID = "Compendium.essence20.gi_joe_crb.Item.84JYgd6kZgY41wge";
// (Shield Upgrade is a DefenseAura rule on its Perk - rules/conv15-items1.test.js.)
const PROTECTORS_SHIELD_ID = "Compendium.essence20.gi_joe_crb.Item.tGdWBibKFTYfXzVu";

global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

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

describe("applyProtectorsShieldHealthBonus", () => {
  function makeActor({ hasPerk = true, healthBonus = 0 } = {}) {
    const items = hasPerk ? [{ type: 'perk', flags: { core: { sourceId: PROTECTORS_SHIELD_ID } } }] : [];
    return { items, system: { health: { bonus: healthBonus } }, update: jest.fn() };
  }

  test("adds 1 Temporary Health when activating, with the Perk", async () => {
    const actor = makeActor({ healthBonus: 0 });
    await applyProtectorsShieldHealthBonus(actor, true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 1 });
  });

  test("removes 1 Temporary Health when deactivating, with the Perk", async () => {
    const actor = makeActor({ healthBonus: 1 });
    await applyProtectorsShieldHealthBonus(actor, false);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 0 });
  });

  test("does nothing without the Perk", async () => {
    const actor = makeActor({ hasPerk: false });
    await applyProtectorsShieldHealthBonus(actor, true);
    expect(actor.update).not.toHaveBeenCalled();
  });
});
