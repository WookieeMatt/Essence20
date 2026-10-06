import { actorHasPerk } from "../../mechanics/characters/perks.mjs";
import { E20 } from "../../util/config.mjs";
import { applyTimedCondition } from "../../mechanics/combat/timed-status.mjs";

// Technologist (Transformers CRB, Gadgeteer Focus, 1st level, p.81): "When a Scientist Role Perk
// only uses the Science Skill, you can use Science or Technology." Flashy is exactly such a
// Perk (a hardcoded `skill: 'science'` roll below) - widened here to whichever of the actor's own
// Science/Technology shifts is better, same unconditional best-of idiom Circuit Breaker/Aerial
// Acrobat already establish for "use X instead of Y" substitutions.
const TECHNOLOGIST_ID = "Compendium.essence20.tf_crb.Item.tdFzQ0IOtoHQ0vmy";

/**
 * Flashy (Transformers CRB, Scientist Role, 14th level, p.80): "when you successfully attack
 * with an Electric weapon, you can make a Science Skill Test against the Toughness of the target
 * of your attack. On a success, they become Blinded 2."
 *
 * A genuinely reactive Perk - the trigger ("after a successful Electric-weapon attack") isn't
 * knowable until the original attack roll has already resolved, so this needs its own post-roll
 * chat button, the same shape Exploit Weakness's own addExploitWeaknessButton/
 * items/attacks/exploit-weakness.mjs already establishes, rather than a pre-roll checkbox. Clicking it
 * triggers a REAL Science-vs-Toughness Skill Test via actor._dice.rollSkill() against whichever
 * token is currently targeted - the same "still targeted at click time" idiom Siphon's own
 * activateSiphon already relies on, since RAW's own follow-up Test needs the target's actual
 * Toughness Defense, not a flat DIF like Exploit Weakness's.
 *
 * "Blinded 2" is 2 rounds of Blinded (mechanics/combat/timed-status.mjs counts it down in combat), or 4
 * with Multiplication.
 */
export const FLASHY_ID = "Compendium.essence20.tf_crb.Item.l79g3PoYo7nyln4X";

/**
 * Triggers the follow-up Science-vs-Toughness Skill Test against whichever token is currently
 * targeted.
 * @param {Actor} actor
 */
export async function activateFlashy(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.FlashyNoTarget'));
    return;
  }

  let skill = 'science';
  if (actorHasPerk(actor, TECHNOLOGIST_ID)) {
    const rollData = actor.getRollData();
    const scienceIndex = E20.skillShiftList.indexOf(rollData.skills.science?.shift);
    const technologyIndex = E20.skillShiftList.indexOf(rollData.skills.technology?.shift);
    if (technologyIndex >= 0 && (scienceIndex < 0 || technologyIndex < scienceIndex)) {
      skill = 'technology';
    }
  }

  await actor._dice.rollSkill({
    skill, essence: 'smarts', shiftUp: 0, shiftDown: 0,
    defenseType: 'toughness', isFlashyAttempt: true,
  }, actor);
}

// Multiplication (TF CRB, Scientist, 18th level, p.80) doubles Scientist Role Perks' numeric
// benefits: Blinded 2 becomes Blinded 4.
const MULTIPLICATION_ID = "Compendium.essence20.tf_crb.Item.K3FNcAMjjek1UaJk";

/** The rounds of Blinded a Flashy success inflicts: 2, or 4 with Multiplication. */
export function flashyBlindedRounds(attacker) {
  return attacker && actorHasPerk(attacker, MULTIPLICATION_ID) ? 4 : 2;
}

/**
 * Applies Blinded to the target on a successful Flashy Skill Test, for its 2 rounds (or 4).
 * @param {Actor} targetActor
 * @param {Actor} [attacker]   The Flashy user, for Multiplication.
 */
export async function applyFlashyBlinded(targetActor, attacker = null) {
  await applyTimedCondition(targetActor, 'blinded', flashyBlindedRounds(attacker));
}
