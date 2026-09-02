import { jest } from '@jest/globals';
import { applyNoNeedToAim } from './no-need-to-aim.mjs';

// No module mocking anywhere else in this codebase (see combat.test.js's own Impenetrable Shield
// suite, or horseshoes-and-handgrenades.test.js) - actorHasPerk/applyDamage/isMultipleTargetsWeapon
// are exercised for real here too, against plain fake actor/item/token shapes.

const NO_NEED_TO_AIM_ID = "Compendium.essence20.gi_joe_crb.Item.GHVeLpZ8opWy1Sje";

function makeActor({ hasPerk = true, weaponTraits = ['multipleTargets'] } = {}) {
  const items = hasPerk
    ? [{ type: 'perk', flags: { core: { sourceId: NO_NEED_TO_AIM_ID } } }]
    : [];
  const weapon = { system: { itemAndUpgradeTraits: weaponTraits } };

  return { items: Object.assign(items, { get: jest.fn(() => weapon) }) };
}

function makeWeaponEffect({ damageType = 'ballistic' } = {}) {
  return {
    type: 'weaponEffect',
    flags: { essence20: { parentId: 'weapon1' } },
    system: { damageType },
  };
}

function makeToken(health = 10) {
  return { actor: { system: { health: { value: health }, immunities: {} }, update: jest.fn() } };
}

describe("applyNoNeedToAim", () => {
  // jest.setup.js's shared global.game has no `user` field at all (nothing else needed one until
  // now) - own it here rather than mutating the shared object from outside a test.
  beforeEach(() => {
    global.game.user = { targets: [] };
  });

  test("applies 1 Damage of the weapon's type to every currently-targeted token", async () => {
    const actor = makeActor();
    const item = makeWeaponEffect({ damageType: 'ballistic' });
    const tokenA = makeToken(10);
    const tokenB = makeToken(5);
    global.game.user.targets = [tokenA, tokenB];

    await applyNoNeedToAim(actor, item);

    expect(tokenA.actor.update).toHaveBeenCalledWith({ 'system.health.value': 9 });
    expect(tokenB.actor.update).toHaveBeenCalledWith({ 'system.health.value': 4 });
  });

  test("does nothing if the attacker doesn't have the Perk", async () => {
    const actor = makeActor({ hasPerk: false });
    const item = makeWeaponEffect();
    const token = makeToken(10);
    global.game.user.targets = [token];

    await applyNoNeedToAim(actor, item);

    expect(token.actor.update).not.toHaveBeenCalled();
  });

  test("does nothing for a weapon without the Multiple Targets trait, even with the Perk", async () => {
    const actor = makeActor({ weaponTraits: [] });
    const item = makeWeaponEffect();
    const token = makeToken(10);
    global.game.user.targets = [token];

    await applyNoNeedToAim(actor, item);

    expect(token.actor.update).not.toHaveBeenCalled();
  });

  test("does nothing when nothing is currently targeted", async () => {
    const actor = makeActor();
    const item = makeWeaponEffect();
    global.game.user.targets = [];

    await expect(applyNoNeedToAim(actor, item)).resolves.not.toThrow();
  });

  test("skips a targeted token with no actor", async () => {
    const actor = makeActor();
    const item = makeWeaponEffect();
    global.game.user.targets = [{ actor: null }];

    await expect(applyNoNeedToAim(actor, item)).resolves.not.toThrow();
  });

  test("does nothing for a non-weaponEffect item", async () => {
    const actor = makeActor();
    const item = { type: 'weapon', flags: { essence20: { parentId: 'weapon1' } }, system: {} };
    const token = makeToken(10);
    global.game.user.targets = [token];

    await applyNoNeedToAim(actor, item);

    expect(token.actor.update).not.toHaveBeenCalled();
  });
});
