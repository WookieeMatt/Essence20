import { E20 } from "./config.mjs";
import {
  actorHasPerk, bankPendingBonus, clearPendingBonus, getPendingBonus,
  hasUsedThisEncounter, markUsedThisEncounter,
} from "./perks.mjs";

/**
 * Rise Again (Through the Shattered Grid, General Perk, p.115, prerequisite: Defeated at least
 * once before taking this Perk): "You've been Defeated once. Fortunately, you had the opportunity
 * to learn from your previous experiences, granting you the following benefits:
 * - Once per scene as a Free action, you gain a +5 bonus to a Defense of your choice until the
 *   start of your next turn.
 * - Once per scene, if you are reduced to 0 Health while Morphed, you immediately heal 1 Health
 *   unless the attack is a Critical Success."
 *
 * This entry was previously miscategorized against a "no revive-from-Defeated mechanism" gap that
 * doesn't actually describe either clause here - RAW-verified 2026-09-15 and corrected. Both
 * halves are independent "once per scene" resources (two separate flags, not one shared use).
 *
 * The Defense-bonus half is the same "bank a fixed amount now, consumed once against the next
 * matching Defense comparison" shape Momentary Blur/Hard Target/Resilience already established -
 * a sibling to consumeResilience rather than a reuse of banked-buffs.mjs's own private
 * pickDefenseType() (that picker is deliberately scoped to only Toughness/Willpower/Evasion, per
 * Roll With The Punches' own narrower RAW text - Rise Again's "a Defense of your choice" is
 * unrestricted, so this needs its own picker offering all four).
 *
 * The Defeat-prevention half is built directly into combat.mjs#applyDamage's own existing chain of
 * "would this reduce Health to 0? substitute 1 instead" checks (Immortal Rebel Soul/Renegade
 * Commander/Do Not Go Quietly already established that exact shape) - the two new wrinkles here
 * are the isMorphed gate and the "unless a Critical Success" exception, the latter needing
 * applyDamage's own signature widened with an optional isCrit parameter (computed once by its one
 * real caller, chat.mjs#onApplyDamage, via the same _isCritIsFumble() check the chat card's own
 * critical/fumble highlighting already uses - every other call site simply omits it and defaults
 * to "not a crit", which is the correct behavior for damage that was never rolled against a
 * Defense in the first place, e.g. Stun ticks/auras/environmental damage).
 */
export const PENDING_RISE_AGAIN_DEFENSE_FLAG_KEY = 'pendingRiseAgainDefense';
const RISE_AGAIN_DEFENSE_ENCOUNTER_FLAG = 'riseAgainDefenseUsedThisEncounter';
export const RISE_AGAIN_DEFEAT_ENCOUNTER_FLAG = 'riseAgainDefeatUsedThisEncounter';
export const RISE_AGAIN_ID = "Compendium.essence20.through_the_shattered_grid.Item.9DCNlVGfsEgUX6SC";

/**
 * Whether the Defense-bonus half can actually be used right now - not yet used this scene. Unlike
 * canRiseAgainPreventDefeat below (checked from applyDamage against an arbitrary hit's own
 * ATTACKER, not the holder's own "Use" button click), holding the Perk itself doesn't need a
 * separate check here - canUsePerk's own dispatch only ever reaches this branch for an item whose
 * sourceId already matches, i.e. this actor's own copy of the Perk, the same "no redundant
 * actorHasPerk re-check" idiom every other bankable "canUseX" helper in this project already
 * follows (canUseSelfRevive, canUseBoxShot, ...).
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseRiseAgainDefense(actor) {
  return !hasUsedThisEncounter(actor, RISE_AGAIN_DEFENSE_ENCOUNTER_FLAG);
}

/**
 * Prompts for which of the four Defenses the +5 bonus should apply to.
 * @returns {Promise<String|null>}   One of 'cleverness'/'evasion'/'toughness'/'willpower', or null
 *   if cancelled.
 */
async function pickRiseAgainDefense() {
  const options = Object.keys(E20.defenses)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.defenses[key])}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.RiseAgainPickDefenseTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.RiseAgainPickDefenseLabel')
    }</label><select name="defenseType">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.defenseType.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Prompts for the chosen Defense and banks the +5 bonus, marking this scene's use.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether the picker was actually confirmed (false if cancelled).
 */
export async function activateRiseAgainDefense(actor) {
  const defenseType = await pickRiseAgainDefense();
  if (!defenseType) {
    return false;
  }

  await bankPendingBonus(actor, PENDING_RISE_AGAIN_DEFENSE_FLAG_KEY, { defenseType, defenseBonus: 5 });
  await markUsedThisEncounter(actor, RISE_AGAIN_DEFENSE_ENCOUNTER_FLAG);
  return true;
}

/**
 * Reads back a target's own pending Rise Again bank and, if this attack is being compared against
 * the chosen Defense, returns the banked bonus and consumes it.
 * @param {Actor} targetActor   The actor being attacked (not the attacker).
 * @param {String} defenseType   The Defense this attack is actually being compared against.
 * @returns {Promise<Number>}   The banked bonus (0 if there's nothing to consume).
 */
export async function consumeRiseAgainDefense(targetActor, defenseType) {
  const pending = getPendingBonus(targetActor, PENDING_RISE_AGAIN_DEFENSE_FLAG_KEY);
  if (!pending || pending.defenseType != defenseType) {
    return 0;
  }

  await clearPendingBonus(targetActor, PENDING_RISE_AGAIN_DEFENSE_FLAG_KEY);
  return pending.defenseBonus;
}

/**
 * Whether the Defeat-prevention half should fire right now: the actor holds the Perk, is Morphed,
 * hasn't already used this half this scene, and the incoming hit wasn't a Critical Success.
 * @param {Actor} actor
 * @param {Boolean} isCrit
 * @returns {Boolean}
 */
export function canRiseAgainPreventDefeat(actor, isCrit) {
  return !isCrit && !!actor.system?.isMorphed && actorHasPerk(actor, RISE_AGAIN_ID)
    && !hasUsedThisEncounter(actor, RISE_AGAIN_DEFEAT_ENCOUNTER_FLAG);
}
