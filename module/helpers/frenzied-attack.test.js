import { jest } from '@jest/globals';
import { activateFrenziedAttack, canActivateFrenziedAttack, FRENZIED_ATTACK_ID } from './frenzied-attack.mjs';

global.game = { combat: null };

function makeItem({ type = 'weaponEffect', parentId = null, name = 'Unarmed Combat' } = {}) {
  return {
    type,
    name,
    flags: parentId ? { essence20: { parentId } } : {},
    roll: jest.fn().mockResolvedValue('rolled'),
  };
}

function makeActor({ hasPerk = true, energon = 1, parentWeapon = null } = {}) {
  const items = hasPerk ? [{ type: 'perk', flags: { core: { sourceId: FRENZIED_ATTACK_ID } } }] : [];
  items.get = jest.fn(() => parentWeapon);
  return {
    items,
    system: { energon: { normal: { value: energon } } },
    update: jest.fn(),
  };
}

describe("canActivateFrenziedAttack", () => {
  test("true for an unarmed attack with the Perk and an Energon Point", () => {
    const actor = makeActor({ hasPerk: true, energon: 1 });
    expect(canActivateFrenziedAttack(actor, makeItem())).toBe(true);
  });

  test("false without the Perk", () => {
    const actor = makeActor({ hasPerk: false, energon: 1 });
    expect(canActivateFrenziedAttack(actor, makeItem())).toBe(false);
  });

  test("false with no Energon left", () => {
    const actor = makeActor({ hasPerk: true, energon: 0 });
    expect(canActivateFrenziedAttack(actor, makeItem())).toBe(false);
  });

  test("false for an attack with a parent weapon (not unarmed)", () => {
    const actor = makeActor({ hasPerk: true, energon: 1, parentWeapon: { id: 'w1' } });
    expect(canActivateFrenziedAttack(actor, makeItem({ parentId: 'w1' }))).toBe(false);
  });

  test("false for a non-weaponEffect item", () => {
    const actor = makeActor({ hasPerk: true, energon: 1 });
    expect(canActivateFrenziedAttack(actor, makeItem({ type: 'weapon' }))).toBe(false);
  });

  test("false with no item", () => {
    const actor = makeActor({ hasPerk: true, energon: 1 });
    expect(canActivateFrenziedAttack(actor, null)).toBe(false);
  });
});

describe("activateFrenziedAttack", () => {
  test("spends 1 Energon Point and rolls the same item again", async () => {
    const actor = makeActor({ energon: 2 });
    const item = makeItem();

    const result = await activateFrenziedAttack(actor, item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.energon.normal.value': 1 });
    expect(item.roll).toHaveBeenCalledWith({}, actor);
    expect(result).toBe('rolled');
  });
});
