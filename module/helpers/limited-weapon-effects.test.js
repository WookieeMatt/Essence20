import { jest } from '@jest/globals';
import {
  canRollLimitedWeaponEffect, isLimitedWeaponEffect, markLimitedWeaponEffectUsed,
} from './limited-weapon-effects.mjs';

const TURBO_THUNDER_CANNON_ENERGY_ATTACK_ID =
  "Compendium.essence20.across_the_stars.Item.Wl7L2wcydXAw9Xei";
const WING_MISSILE_SALVO_BLAST_ID = "Compendium.essence20.across_the_stars.Item.Z6cpZMj1nKTquCLF";
const WING_MISSILE_SALVO_CONE_ID = "Compendium.essence20.across_the_stars.Item.FRue0q6oL8aRWswk";
const UNRELATED_ID = "Compendium.essence20.across_the_stars.Item.doesNotExist12345";

global.game = { combat: { id: 'combat1' } };

function makeActor(usedFlags = {}) {
  return {
    getFlag: jest.fn((scope, key) => (scope == 'essence20' ? usedFlags[key] : undefined)),
    setFlag: jest.fn(async (scope, key, value) => {
      usedFlags[key] = value;
    }),
  };
}

describe("isLimitedWeaponEffect", () => {
  test("true for a listed weaponEffect id, false for anything else", () => {
    expect(isLimitedWeaponEffect(TURBO_THUNDER_CANNON_ENERGY_ATTACK_ID)).toBe(true);
    expect(isLimitedWeaponEffect(WING_MISSILE_SALVO_BLAST_ID)).toBe(true);
    expect(isLimitedWeaponEffect(WING_MISSILE_SALVO_CONE_ID)).toBe(true);
    expect(isLimitedWeaponEffect(UNRELATED_ID)).toBe(false);
    expect(isLimitedWeaponEffect(undefined)).toBe(false);
  });
});

describe("canRollLimitedWeaponEffect", () => {
  test("an unlisted effect is always rollable", () => {
    expect(canRollLimitedWeaponEffect(makeActor(), UNRELATED_ID)).toBe(true);
  });

  test("a listed effect is rollable until marked used this encounter", () => {
    const actor = makeActor();
    expect(canRollLimitedWeaponEffect(actor, TURBO_THUNDER_CANNON_ENERGY_ATTACK_ID)).toBe(true);

    actor.setFlag('essence20', 'turboThunderCannonEnergyAttackUsedThisEncounter', {
      epoch: 1, window: 'encounter', count: 1,
    });
    expect(canRollLimitedWeaponEffect(actor, TURBO_THUNDER_CANNON_ENERGY_ATTACK_ID)).toBe(false);
  });

  test("Wing Missile Salvo's Blast and Multiple Targets profiles share a single cap", async () => {
    const actor = makeActor();
    await markLimitedWeaponEffectUsed(actor, WING_MISSILE_SALVO_BLAST_ID);

    expect(canRollLimitedWeaponEffect(actor, WING_MISSILE_SALVO_BLAST_ID)).toBe(false);
    expect(canRollLimitedWeaponEffect(actor, WING_MISSILE_SALVO_CONE_ID)).toBe(false);
  });
});

describe("markLimitedWeaponEffectUsed", () => {
  test("marks a listed effect used this encounter", async () => {
    const actor = makeActor();
    await markLimitedWeaponEffectUsed(actor, TURBO_THUNDER_CANNON_ENERGY_ATTACK_ID);
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'turboThunderCannonEnergyAttackUsedThisEncounter', expect.objectContaining({ count: 1 }),
    );
  });

  test("is a no-op for an unlisted effect", async () => {
    const actor = makeActor();
    await markLimitedWeaponEffectUsed(actor, UNRELATED_ID);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
