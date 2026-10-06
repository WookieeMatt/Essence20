/**
 * The Personal Power choke point: every write to system.powers.personal.value, wherever it comes
 * from (the Power sheet cost, Perk costs, Rest, the sidebar), passes through the actor update
 * hooks, so this is where "whenever you spend / regain Personal Power" rules live.
 *
 * - A decrease is a spend, unless the writer marks it `{essence20Loss: true}` (Power drained by an
 *   enemy, Body of Energy's damage) or `{essence20Refund: true}` (this file's own refunds).
 * - An increase is regaining Power.
 *
 * Void Warrior (Across the Stars, Grid Power, p.73): "...for the remainder of the scene. While this
 * Grid Power is active, you cannot regain Personal Power." - regain is blocked in preUpdateActor,
 * and the Power ends with the scene (helpers/void-warrior.mjs sets the flag and never cleared it).
 *
 * Inner Conservation, Power Efficiency (Through the Shattered Grid) and Dino Charged (Beneath the
 * Helmet) are their items' own resourceSpent Trigger rules.
 *
 * Body of Energy (Across the Stars, Phantom Ranger, 8th level, p.61): "While Morphed, your Health
 * and Personal Power points are interchangeable, becoming one pool of Personal Power. When you
 * spend or lose Health or Power for any reason, you reduce your combined pool accordingly. When you
 * exit your Morphed form for any reason other than being Defeated, your Health and Personal Power
 * return to a value equal to half of your remaining combined pool points."
 * Damage past the last point of Health comes out of Power (Health is only emptied with the pool);
 * leaving Morph splits the pool in half. Moving Health into Power for a spend is the Perk's own Use
 * rule (pack data).
 */
import {
  registerDamageModifier, registerSceneAdvanced,
} from "../../extensions.mjs";
import { IDS, onHook, T, changed, setChanged, has, isActiveGm, num, say, worldActors } from "./common.mjs";

const POWER = 'system.powers.personal.value';
const VOID_FLAG = 'voidWarriorActive';

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
/*  Before the write                             */
/* -------------------------------------------- */

onHook('preUpdateActor', (actor, changes, options, userId) => {
  const next = changed(changes, POWER);
  const nextMorph = changed(changes, 'system.isMorphed');
  if (next === undefined && nextMorph === undefined) {
    return;
  }

  options.essence20Prev = {
    power: num(actor.system?.powers?.personal?.value),
    health: num(actor.system?.health?.value),
    morphed: !!actor.system?.isMorphed,
  };

  // Void Warrior: no regaining Personal Power while it's active.
  if (next !== undefined && num(next) > options.essence20Prev.power && actor.flags?.essence20?.[VOID_FLAG]) {
    setChanged(changes, POWER, options.essence20Prev.power);
    if (userId == game.user?.id) {
      ui.notifications?.info(T('ResVoidWarriorNoRegen', { name: actor.name }));
    }
  }
});

/* -------------------------------------------- */
/*  After the write                              */
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

onHook('updateActor', (actor, changes, options, userId) => {
  if (userId != game.user?.id || !options?.essence20Prev) {
    return;
  }

  const prev = options.essence20Prev;
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

/* -------------------------------------------- */
/*  Void Warrior ends with the scene             */
/* -------------------------------------------- */

registerSceneAdvanced(async () => {
  if (!isActiveGm()) {
    return;
  }

  for (const actor of worldActors()) {
    if (actor.flags?.essence20?.[VOID_FLAG]) {
      await actor.unsetFlag('essence20', VOID_FLAG);
    }
  }
});
