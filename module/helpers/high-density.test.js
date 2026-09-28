import { jest } from '@jest/globals';
import {
  HIGH_DENSITY_FOLLOW_UP_SHIFT_DOWN, canOfferHighDensityFollowUp, hasDifferentTarget, highDensityFollowUpDataset,
  isHighDensityWeapon, rollHighDensityFollowUp,
} from "./high-density.mjs";

describe("High-Density (Factions in Action Vol. 2, New Weapon Traits, p.92)", () => {
  test("isHighDensityWeapon reads the (upgrade-merged) trait list", () => {
    expect(isHighDensityWeapon({ system: { traits: ['laser', 'highDensity'] } })).toBe(true);
    expect(isHighDensityWeapon({ system: { traits: ['laser'] } })).toBe(false);
    expect(isHighDensityWeapon(undefined)).toBe(false);
  });

  test("the follow-up is at ↓1", () => {
    expect(HIGH_DENSITY_FOLLOW_UP_SHIFT_DOWN).toBe(1);
  });

  describe("canOfferHighDensityFollowUp", () => {
    const hit = { isAttack: true, isHighDensityAttack: true, highDensityFollowUp: false, rollFailed: false, itemUuid: 'Item.x' };

    test("offered after a High-Density Attack that hit", () => {
      expect(canOfferHighDensityFollowUp(hit)).toBe(true);
    });

    test("not after a miss, a plain roll with no target, a non-High-Density weapon, or a follow-up", () => {
      expect(canOfferHighDensityFollowUp({ ...hit, rollFailed: true })).toBe(false);
      expect(canOfferHighDensityFollowUp({ ...hit, rollFailed: undefined })).toBe(false);
      expect(canOfferHighDensityFollowUp({ ...hit, isHighDensityAttack: false })).toBe(false);
      expect(canOfferHighDensityFollowUp({ ...hit, isAttack: false })).toBe(false);
      expect(canOfferHighDensityFollowUp({ ...hit, highDensityFollowUp: true })).toBe(false);
      expect(canOfferHighDensityFollowUp({ ...hit, itemUuid: null })).toBe(false);
      expect(canOfferHighDensityFollowUp(undefined)).toBe(false);
    });
  });

  describe("hasDifferentTarget", () => {
    const first = { actor: { uuid: 'Actor.first' } };
    const second = { actor: { uuid: 'Actor.second' } };

    test("needs at least one target that isn't the first Attack's own", () => {
      expect(hasDifferentTarget(new Set([second]), 'Actor.first')).toBe(true);
      expect(hasDifferentTarget([first, second], 'Actor.first')).toBe(true);
      expect(hasDifferentTarget([first], 'Actor.first')).toBe(false);
      expect(hasDifferentTarget([], 'Actor.first')).toBe(false);
      expect(hasDifferentTarget(undefined, 'Actor.first')).toBe(false);
    });
  });

  test("the follow-up rolls the same weaponEffect with the follow-up flag and no action cost", async () => {
    expect(highDensityFollowUpDataset()).toEqual({ highDensityFollowUp: true, bypassEconomy: true });

    const actor = { name: 'Shooter' };
    const item = { roll: jest.fn(async () => 'rolled') };
    await expect(rollHighDensityFollowUp(actor, item)).resolves.toBe('rolled');
    expect(item.roll).toHaveBeenCalledWith({ highDensityFollowUp: true, bypassEconomy: true }, actor);
  });
});
