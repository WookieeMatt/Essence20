import { actorHasPerk, bankPendingBonus } from "./perks.mjs";

/**
 * Time To Think (MLP Magic, 3rd level, p.94): "when you go last in the Initiative Order, you gain
 * Edge on your first Skill Test of the scene." "First Skill Test of the scene" is approximated as
 * "your next roll" - the same documented bank-now/consume-later simplification every other
 * "until/on your next X" Perk in this codebase already accepts (see perks.mjs#bankPendingBonus's
 * own doc comment) - consumed in dice.mjs's _getAutomaticCombatModifiers self-status section,
 * same as Think On It.
 *
 * Checked once combat actually begins (Foundry's own "combatStart" hook, essence20.mjs), by which
 * point every combatant should have an Initiative value - NOT on every individual roll, since
 * "last in the order" can only be judged once the whole order is settled. A tie for lowest
 * Initiative grants Edge to every combatant tied for last, rather than picking one arbitrarily.
 */
const TIME_TO_THINK_ID = "Compendium.essence20.mlp_crb.Item.aoqbVibH10pj8rn7";

/**
 * @param {Combat} combat
 */
export async function applyTimeToThinkEdge(combat) {
  const combatants = (combat?.combatants ?? []).filter(c => c.initiative != null && c.actor);
  if (!combatants.length) {
    return;
  }

  const minInitiative = Math.min(...combatants.map(c => c.initiative));
  for (const combatant of combatants) {
    if (combatant.initiative == minInitiative && actorHasPerk(combatant.actor, TIME_TO_THINK_ID)) {
      await bankPendingBonus(combatant.actor, 'pendingTimeToThink', { edge: true });
    }
  }
}
