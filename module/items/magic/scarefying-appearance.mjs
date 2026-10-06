import { E20 } from "../../util/config.mjs";
import { activateForRounds, isActiveForRounds } from "../../mechanics/resources/scene-clock.mjs";
import { sizeChangeCandidates } from "../forms/size-change-potions.mjs";

// Scarefying Appearance (Knights of Canterlot, Virtuoso Enchantment spell, p.51): "you get the
// following benefits: You gain a +2 to the use of the Intimidation Skill. You step up one size
// category." Built as a self-only on/off flag (a target actor could theoretically cast this on
// itself only - Range: Reach - matching every other self-cast spell's flag shape) storing the
// actor's ORIGINAL size so it can be restored exactly on deactivation, the same "save and restore"
// idiom Monster Grow! (items/forms/monster-grow.mjs) already established, just stepping ONE size
// category up the E20.actorSizes ladder instead of jumping straight to Gigantic. The +2
// Intimidation shiftUp itself is read directly in dice.mjs#rollSkill, same shape as every other
// self-status shiftUp this project has built.
//
// The spell's other two benefits live in mechanics/combat/target-riders.mjs: the Frightened save card for
// Threats of the same or smaller size, and the "pick two of" benefits (+2 Toughness, Claws,
// Wings, or ↑1 Might / an extra ↑1 Intimidation), which read isScarefyingAppearanceActive below
// and so end with the spell.
//
// "10 Rounds": casting also stamps a round-counted Scene Clock duration
// (scene-clock.mjs#activateForRounds). The active GM's client reverts the size when those rounds
// run out (updateCombat), when the Combat ends, or when a new scene starts - the hooks at the
// bottom of this file. Out of Combat there are no rounds to count, so it lasts the rest of the
// encounter. Recasting after it has run out reverts the stale one first.

const SCAREFYING_APPEARANCE_FLAG = 'scarefyingAppearanceOriginalSize';
const SCAREFYING_APPEARANCE_UNTIL_FLAG = 'scarefyingAppearanceUntil';
const SCAREFYING_APPEARANCE_ROUNDS = 10;

/**
 * Whether the spell's duration has run out - or it was cast before the spell had a duration at
 * all - while the size change is still in place.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isScarefyingAppearanceExpired(actor) {
  return !!actor?.getFlag?.('essence20', SCAREFYING_APPEARANCE_FLAG)
    && !isActiveForRounds(actor, SCAREFYING_APPEARANCE_UNTIL_FLAG);
}

export function isScarefyingAppearanceActive(actor) {
  if (!actor?.getFlag?.('essence20', SCAREFYING_APPEARANCE_FLAG)) {
    return false;
  }

  // No duration record at all is a cast from before the spell had one: it still reads as active
  // until the next sweep below puts the size back, rather than silently dropping the +2 while the
  // actor is still stepped up.
  return !actor.getFlag('essence20', SCAREFYING_APPEARANCE_UNTIL_FLAG)
    || isActiveForRounds(actor, SCAREFYING_APPEARANCE_UNTIL_FLAG);
}

export async function applyScarefyingAppearance(actor) {
  if (isScarefyingAppearanceExpired(actor)) {
    await removeScarefyingAppearance(actor);
  }

  if (isScarefyingAppearanceActive(actor)) {
    return;
  }

  const sizeOrder = Object.keys(E20.actorSizes);
  const currentIndex = sizeOrder.indexOf(actor.system.size);
  const nextSize = currentIndex >= 0 && currentIndex < sizeOrder.length - 1
    ? sizeOrder[currentIndex + 1]
    : actor.system.size;

  await actor.setFlag('essence20', SCAREFYING_APPEARANCE_FLAG, actor.system.size);
  await activateForRounds(actor, SCAREFYING_APPEARANCE_UNTIL_FLAG, SCAREFYING_APPEARANCE_ROUNDS);
  await actor.update({ 'system.size': nextSize });
}

export async function removeScarefyingAppearance(actor) {
  const originalSize = actor.getFlag('essence20', SCAREFYING_APPEARANCE_FLAG);
  if (originalSize) {
    await actor.update({ 'system.size': originalSize });
  }

  await actor.unsetFlag('essence20', SCAREFYING_APPEARANCE_FLAG);
  await actor.unsetFlag('essence20', SCAREFYING_APPEARANCE_UNTIL_FLAG);
}

/**
 * Reverts every Scarefying Appearance whose duration has run out. Active GM only, so nothing is
 * written twice.
 * @param {Array<Actor>} [actors]   Who to check; every candidate actor by default.
 * @param {String} [endedCombatId]   A Combat that has just ended: anything counting its rounds ends
 *   too, whether or not the Combat has left game.combats yet.
 * @returns {Promise<void>}
 */
export async function expireScarefyingAppearances(actors = null, endedCombatId = null) {
  if (!globalThis.game?.users?.activeGM?.isSelf) {
    return;
  }

  for (const actor of actors ?? sizeChangeCandidates()) {
    const until = actor?.getFlag?.('essence20', SCAREFYING_APPEARANCE_UNTIL_FLAG);
    const endedWithCombat = !!endedCombatId && until?.combatId == endedCombatId
      && !!actor.getFlag('essence20', SCAREFYING_APPEARANCE_FLAG);
    if (endedWithCombat || isScarefyingAppearanceExpired(actor)) {
      await removeScarefyingAppearance(actor);
    }
  }
}

function combatActors(combat) {
  return [...(combat?.combatants ?? [])].map(combatant => combatant.actor).filter(Boolean);
}

globalThis.Hooks?.on?.('updateCombat', (combat, changes) => {
  if (changes && ('round' in changes || 'turn' in changes)) {
    expireScarefyingAppearances(combatActors(combat));
  }
});
globalThis.Hooks?.on?.('deleteCombat', combat => expireScarefyingAppearances(combatActors(combat), combat?.id));
globalThis.Hooks?.on?.('essence20.sceneAdvanced', () => expireScarefyingAppearances());
