/**
 * Body of Energy (Across the Stars, Phantom Ranger, 8th level, p.61): "While Morphed, your Health
 * and Personal Power points are interchangeable, becoming one pool of Personal Power. When you
 * spend or lose Health or Power for any reason, you reduce your combined pool accordingly. When you
 * exit your Morphed form for any reason other than being Defeated, your Health and Personal Power
 * return to a value equal to half of your remaining combined pool points."
 * Damage past the last point of Health comes out of Power (Health is only emptied with the pool);
 * leaving Morph splits the pool in half. Moving Health into Power for a spend is the Perk's own Use
 * rule (pack data).
 */
import { registerDamageModifier } from "../../mechanics/item-hooks.mjs";
import { POWER, registerAfterPowerWrite } from "../../mechanics/resources/personal-power-spend.mjs";
import { changed, IDS } from "../shared/resource-team-lookups.mjs";
import { T } from "../shared/item-lang.mjs";
import { has } from "../shared/item-lookups.mjs";
import { num } from "../shared/numbers.mjs";
import { say } from "../shared/chat-lines.mjs";

/**
 * Body of Energy's split of a hit between Health and Power.
 * @returns {{health: Number, power: Number}}   The new values.
 */
export function bodyOfEnergySplit(health, power, damage) {
  const total = Math.max(0, health + power - damage);
  if (total <= 0) {
    return { health: 0, power: 0 };
  }

  const newHealth = Math.max(1, health - damage);
  return { health: Math.min(newHealth, total), power: Math.max(0, total - Math.min(newHealth, total)) };
}

/** Health and Power on leaving Morph: each becomes half the pool (rounded down), within max. */
export function bodyOfEnergyUnmorph(health, power, healthMax, powerMax) {
  const half = Math.floor((health + power) / 2);
  return { health: Math.min(half, healthMax), power: Math.min(half, powerMax) };
}

/* -------------------------------------------- */
/*  Leaving Morph                                */
/* -------------------------------------------- */

async function onUnmorph(actor, prev) {
  if (!has(actor, IDS.bodyOfEnergy) || prev.health <= 0 || num(actor.system?.health?.value) <= 0) {
    return;
  }

  const split = bodyOfEnergyUnmorph(num(actor.system.health.value), num(actor.system.powers?.personal?.value),
    num(actor.system.health.max), num(actor.system.powers?.personal?.max));
  await actor.update({ 'system.health.value': split.health, [POWER]: split.power }, { essence20Refund: true, essence20Loss: true });
  await say(actor, T('ResBodyOfEnergyUnmorph', { name: actor.name, health: split.health, power: split.power }));
}

registerAfterPowerWrite((actor, changes, prev) => {
  if (prev.morphed && changed(changes, 'system.isMorphed') === false) {
    onUnmorph(actor, prev).catch(error => console.error('Essence20 | Body of Energy', error));
  }
});

/* -------------------------------------------- */
/*  Body of Energy                               */
/* -------------------------------------------- */

registerDamageModifier(async (actor, amount) => {
  if (!(amount > 0) || !actor?.system?.isMorphed || !has(actor, IDS.bodyOfEnergy)) {
    return amount;
  }

  const health = num(actor.system.health?.value);
  const power = num(actor.system.powers?.personal?.value);
  if (amount < health || power <= 0) {
    return amount;
  }

  const split = bodyOfEnergySplit(health, power, amount);
  await actor.update({ [POWER]: split.power }, { essence20Loss: true });
  return health - split.health;
});
