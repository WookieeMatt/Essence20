import { actorHasPerk } from "./perks.mjs";
import { getNearbyAllyTokens } from "./allies.mjs";

/**
 * Tactical Meditation (Through the Shattered Grid, Guardian of Eltar, Chief Guardian choice,
 * p.73): "Your mind is full of battle strategies and tactics. You cannot be surprised, and allies
 * within 10 feet of you gain ↑2 to Alertness and Initiative Skill Tests."
 *
 * One of 3 named Chief Guardian options (Energy Rebuttal, Guardian Blast, Tactical Meditation),
 * each its own real compendium Item wired via the existing generic `hasChoice: true,
 * choiceType: "perks", numChoices: 1` picker (the same mechanism Modified Shell already uses) -
 * Chief Guardian's own `selectionLimit: 1` means only one is ever picked, unlike Wisdom of the
 * Elders' own toggle-per-instance shape. Energy Rebuttal and Guardian Blast stay Needs new
 * infrastructure (a "react to a failed Defend" hook, and a multi-actor combined-action Skill
 * Test respectively) - still offered in the picker per the "the choice still exists even when
 * unautomated" idiom.
 *
 * "You cannot be surprised" is unenforceable (no Surprised status exists anywhere in this system -
 * the same accepted gap Prepare for War/Sirens Blaring/Exploit Trust already live with). The aura
 * half - a self+nearby-allies shiftUp, matching the disposition-equality "ally" proxy this
 * project's own getNearbyAllyTokens already establishes - needs its own check in TWO places
 * (dice.mjs#rollSkill for Alertness, dice.mjs#prepareInitiativeRoll for Initiative, since
 * Initiative is never rolled through rollSkill() in practice - the same split Enhanced Reflexes'
 * identical two-skill aura/self grant already needed).
 */
const TACTICAL_MEDITATION_ID = "Compendium.essence20.through_the_shattered_grid.Item.TacticalMedit8ns";
const RADIUS_FEET = 10;

/**
 * Whether the actor is within Tactical Meditation's own aura - either because they hold the Perk
 * themselves, or a nearby ally (same disposition, within 10ft) does.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasNearbyTacticalMeditation(actor) {
  if (actorHasPerk(actor, TACTICAL_MEDITATION_ID)) {
    return true;
  }

  return getNearbyAllyTokens(actor, RADIUS_FEET).some(token => actorHasPerk(token.actor, TACTICAL_MEDITATION_ID));
}
