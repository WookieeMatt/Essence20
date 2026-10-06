import { actorHasPerk } from "../characters/perks.mjs";

/**
 * How many Free, Move and Standard actions an actor gets from its Speed (or, with the Perks below, another Essence).
 */

// Quick Thinker (MLP CRB, General Perk, p.125): "you gain a number of Free actions equal to your
// Smarts Essence minus 2, instead of your Speed Essence minus 2."
const QUICK_THINKER_ID = "Compendium.essence20.mlp_crb.Item.i0PwoR0hDC0vyDD2";

// University Days (WTNV Citizen's Guide, General Perk, p.53) - verbatim identical text/effect to
// Quick Thinker above, just a different compendium item (a separate book, same mechanic).
const UNIVERSITY_DAYS_ID = "Compendium.essence20.wtnv_citizens_guide.Item.5T3DHQjLjyM9J5tS";

// Foot Soldier (TF CRB, Warrior Role Perk, 1st level, p.91): "When in Bot Mode, treat your Speed
// as if it was 2 higher when calculating how many Free actions you get on your turn." Unlike
// Quick Thinker/University Days above (a different SOURCE Essence for the same -2 formula), this
// keeps Speed as the source and just raises it by 2 - and only applies in Bot Mode.
const FOOT_SOLDIER_ID = "Compendium.essence20.tf_crb.Item.VXQ32nRPF4qEYTZR";

/**
 * Prepare the number of actions available for the given actor
 * @param {Actor} actor The actor to get actions for
 * @return {Object} Action types mapped to an action count
 */
export function getNumActions(actor) {
  // Character/NPC/Companion essences use .max (character.mjs); Vehicle/Zord/Megaform's
  // machine-based essences (machine.mjs, zord-base.mjs) use .value instead - there's no .max
  // on those to read. Actor types with no Essence scores at all (e.g. Party) have no action
  // economy.
  const speedEssence = actor.system.essences?.speed;
  if (!speedEssence) {
    return { free: 0, movement: 0, standard: 0 };
  }

  const speed = speedEssence.max ?? speedEssence.value ?? 0;

  // Quick Thinker - see QUICK_THINKER_ID's own comment above. Free actions come from Smarts
  // instead of Speed while the actor holds the Perk; movement/standard actions are unaffected.
  let freeActionEssence = speed;
  if (actorHasPerk(actor, QUICK_THINKER_ID) || actorHasPerk(actor, UNIVERSITY_DAYS_ID)) {
    const smartsEssence = actor.system.essences.smarts;
    freeActionEssence = smartsEssence.max ?? smartsEssence.value ?? 0;
  } else if (actorHasPerk(actor, FOOT_SOLDIER_ID) && !actor.system.isTransformed) {
    freeActionEssence = speed + 2;
  }

  return {
    free: Math.max(0, freeActionEssence - 2),
    movement: speed > 0 ? 1 : 0,
    standard: speed > 1 ? 1 : 0,
  };
}
