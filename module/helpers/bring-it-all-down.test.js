import { jest } from '@jest/globals';
import { BRING_IT_ALL_DOWN_ID, isExplosiveWeaponEffect, pickBringItAllDownEffect } from './bring-it-all-down.mjs';

function makeActor({ hasPerk = true } = {}) {
  return {
    items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: BRING_IT_ALL_DOWN_ID } } }] : [],
  };
}

function makeExplosiveEffect() {
  return { type: 'weaponEffect', system: { classification: { style: 'explosive' } } };
}

describe("isExplosiveWeaponEffect", () => {
  test("true for an explosive-style weaponEffect", () => {
    expect(isExplosiveWeaponEffect(makeExplosiveEffect())).toBe(true);
  });

  test("false for a non-explosive weaponEffect", () => {
    expect(isExplosiveWeaponEffect({ type: 'weaponEffect', system: { classification: { style: 'melee' } } })).toBe(false);
  });

  test("false for a non-weaponEffect item", () => {
    expect(isExplosiveWeaponEffect({ type: 'weapon', system: {} })).toBe(false);
  });

  test("false with no item", () => {
    expect(isExplosiveWeaponEffect(null)).toBe(false);
  });
});

describe("pickBringItAllDownEffect", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
    global.game = { i18n: { localize: jest.fn((key) => key) } };
  });

  test("never prompts without the Perk", async () => {
    const result = await pickBringItAllDownEffect(makeActor({ hasPerk: false }), makeExplosiveEffect());
    expect(result).toBeNull();
    expect(waitMock).not.toHaveBeenCalled();
  });

  test("never prompts on a non-explosive attack, even with the Perk", async () => {
    const meleeEffect = { type: 'weaponEffect', system: { classification: { style: 'melee' } } };
    const result = await pickBringItAllDownEffect(makeActor({ hasPerk: true }), meleeEffect);
    expect(result).toBeNull();
    expect(waitMock).not.toHaveBeenCalled();
  });

  test("returns the chosen effect on confirm", async () => {
    waitMock.mockResolvedValue('armorPiercing');
    expect(await pickBringItAllDownEffect(makeActor(), makeExplosiveEffect())).toBe('armorPiercing');
  });

  test("returns null when the player explicitly picks none", async () => {
    waitMock.mockResolvedValue('none');
    expect(await pickBringItAllDownEffect(makeActor(), makeExplosiveEffect())).toBeNull();
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickBringItAllDownEffect(makeActor(), makeExplosiveEffect())).toBeNull();
  });
});
