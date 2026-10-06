import { jest } from '@jest/globals';
import { applyHorseshoesAndHandgrenades } from './horseshoes-and-handgrenades.mjs';

// No module mocking anywhere else in this codebase (see combat.test.js's own Impenetrable Shield
// suite) - actorHasPerk/applyDamage are exercised for real here too, against plain fake
// actor/item/token shapes.

const HORSESHOES_AND_HANDGRENADES_ID = "Compendium.essence20.gi_joe_crb.Item.NYwpiTjlKxTB2rGF";

function makeActor({ hasPerk = true } = {}) {
  const items = hasPerk
    ? [{ type: 'perk', flags: { core: { sourceId: HORSESHOES_AND_HANDGRENADES_ID } } }]
    : [];

  return { items };
}

function makeWeaponEffect({ style = 'explosive', damageType = 'fire' } = {}) {
  return {
    type: 'weaponEffect',
    system: {
      classification: { style },
      damageType,
    },
  };
}

function makeToken(health = 10) {
  return { actor: { system: { health: { value: health }, immunities: {} }, update: jest.fn() } };
}

describe("applyHorseshoesAndHandgrenades", () => {
  test("applies 1 Damage of the weapon's type to every token caught by the AoE shape", async () => {
    const actor = makeActor();
    const item = makeWeaponEffect({ damageType: 'fire' });
    const tokenA = makeToken(10);
    const tokenB = makeToken(5);

    await applyHorseshoesAndHandgrenades(actor, item, [tokenA, tokenB]);

    expect(tokenA.actor.update).toHaveBeenCalledWith({ 'system.health.value': 9 });
    expect(tokenB.actor.update).toHaveBeenCalledWith({ 'system.health.value': 4 });
  });

  test("does nothing if the attacker doesn't have the Perk", async () => {
    const actor = makeActor({ hasPerk: false });
    const item = makeWeaponEffect();
    const token = makeToken(10);

    await applyHorseshoesAndHandgrenades(actor, item, [token]);

    expect(token.actor.update).not.toHaveBeenCalled();
  });

  test("does nothing for a non-explosive weapon, even with the Perk", async () => {
    const actor = makeActor();
    const item = makeWeaponEffect({ style: 'ballistic' });
    const token = makeToken(10);

    await applyHorseshoesAndHandgrenades(actor, item, [token]);

    expect(token.actor.update).not.toHaveBeenCalled();
  });

  test("does nothing when the AoE shape caught no tokens", async () => {
    const actor = makeActor();
    const item = makeWeaponEffect();

    await expect(applyHorseshoesAndHandgrenades(actor, item, [])).resolves.not.toThrow();
  });

  test("skips a caught token with no actor (e.g. a loose Tile/light, not a real combatant)", async () => {
    const actor = makeActor();
    const item = makeWeaponEffect();
    const emptyToken = { actor: null };

    await expect(applyHorseshoesAndHandgrenades(actor, item, [emptyToken])).resolves.not.toThrow();
  });

  test("does nothing for a non-weaponEffect item", async () => {
    const actor = makeActor();
    const item = { type: 'weapon', system: {} };
    const token = makeToken(10);

    await applyHorseshoesAndHandgrenades(actor, item, [token]);

    expect(token.actor.update).not.toHaveBeenCalled();
  });
});
