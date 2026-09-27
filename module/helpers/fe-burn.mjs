import { actorHasPerk } from "./perks.mjs";
import { getTerrorAvailable, spendTerror } from "./terror.mjs";
import { getNearbyEnemyTokens } from "./enemies.mjs";
import { applyDamage } from "./combat.mjs";
import { onMorph } from "../sheet-handlers/power-ranger-handler.mjs";

/**
 * Fe-BURN! (Beneath the Helmet, Dark Ranger, 9th level, p.40): "While Morphed and have at least 1
 * Terror accrued, when you take damage from any attack that you were aware of, you can spend all
 * your Terror to cause your shell to burst into vibrant flames to reduce the incoming damage by
 * half. For each Terror you spend, you can target an enemy adjacent to you to take Energy damage
 * equal to the other half of the damage you would have taken. You immediately un-Morph after
 * using this Role Perk."
 *
 * RE-CATEGORIZED - this Perk was repeatedly cited alongside Golden Guardian/Counterstrike as
 * needing the still-missing "counter-attack after being hit" reaction shape, but it doesn't need
 * a NEW hook at all: chat.mjs#onApplyDamage already modifies its own `damage` variable in place
 * before applyDamage() runs (Fortitude's own -1 reduction is the existing precedent for exactly
 * this pattern), so halving it here rides the same rail, not a new one. The one genuinely new
 * piece is dealing synthetic retaliation damage to a SECOND actor from within that same GM-confirm
 * flow - applyDamage() is already a plain, callable function, so this is a direct call, not a new
 * roll/mechanism.
 *
 * "For each Terror you spend, you can target an enemy adjacent to you" reads as picking multiple
 * distinct targets as more Terror is spent - approximated here as a single retaliation target
 * (the first adjacent enemy found, auto-detected the same "no click to place" way Absolute
 * Menace/Golden Guardian's own Counterstrike already do), since the GM - not the Fe-BURN! holder's
 * own player - is the one clicking Apply Damage and so can't be asked to interactively pick a
 * target here. A documented simplification, not a guess at unclear RAW.
 */
const FE_BURN_ID = "Compendium.essence20.beneath_the_helmet.Item.y3RPr4nJWVtCtdil";
const ADJACENT_FEET = 5;

/**
 * @param {Actor} target
 * @param {Number} damage   The damage about to be applied, before this Perk's own reduction.
 * @returns {Boolean}   Whether Fe-BURN! is actually eligible to fire.
 */
export function canUseFeBurn(target, damage) {
  return damage > 0 && !!target.system.isMorphed && actorHasPerk(target, FE_BURN_ID) && getTerrorAvailable(target) >= 1;
}

/**
 * Halves the given damage, deals the other half as Energy damage to the first adjacent enemy (if
 * any), spends all accrued Terror, and un-Morphs the actor - see this file's own doc comment.
 * @param {Actor} target
 * @param {Number} damage
 * @returns {Promise<Number>}   The new, halved damage amount to actually apply to target.
 */
export async function activateFeBurn(target, damage) {
  const terrorSpent = getTerrorAvailable(target);
  const halvedDamage = Math.floor(damage / 2);
  const retaliationDamage = damage - halvedDamage;

  await spendTerror(target, terrorSpent);

  const enemyToken = getNearbyEnemyTokens(target, ADJACENT_FEET)[0];
  if (enemyToken?.actor) {
    await applyDamage(enemyToken.actor, retaliationDamage, 'element');
  }

  await onMorph(target);

  return halvedDamage;
}
