import { bankPendingBonus, getPendingBonus } from "./perks.mjs";
import { getNearbyAllyTokens } from "./allies.mjs";

/**
 * "Bank a bonus now, spend it on a Skill Test you haven't rolled yet" Perks - Think On It and
 * Plan of Action share this exact shape (see perks.mjs's own bankPendingBonus/getPendingBonus/
 * clearPendingBonus), but until now nothing on the actor sheet let a player actually trigger
 * one - every other Perk automated in this system either fires off an existing roll/attack
 * automatically, or is a passive always-on check. This file is the one new piece: a "Use"
 * control (wired in essence20.mjs's Handlebars helper + a sheet click listener) for whichever
 * Perks are in the table below, plus the (self or ally) targeting logic for actually banking the
 * bonus once clicked.
 *
 * Alpha Strike (Renegade/Door-Kicker Focus, 3rd level, p.98) was originally scoped alongside
 * these two, but its own text - "you can Alpha Strike IF you are attacking an enemy within your
 * reach or within 20 feet... when you USE Alpha Strike, you gain an Edge..." - ties the choice to
 * the moment of a qualifying attack roll, not a standalone Free/Move action taken independent of
 * one. That's a Roll Options Dialog checkbox (the same shape Quiet as the Grave's own
 * applyDamageDouble toggle already uses), not a sheet "Use" button - a genuinely different UI
 * than the other two, so it's deliberately left out of this file rather than forced into a
 * button click it doesn't fit. Not yet built.
 *
 * Consumption is NOT here - see dice.mjs#_getAutomaticCombatModifiers, which reads these same
 * flagKeys back on the actor's (or the chosen ally's) next roll, the same self-status section
 * Debilitating Strike/Who Dares Wins already use.
 */

const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";

// Perk -> { flagKey, target }. target 'self' banks the bonus directly on the actor using the
// Perk; target 'ally' prompts for which nearby ally to bank it on instead (see pickAllyTarget
// below) - Plan of Action's own text is "grant an ally", not "grant yourself."
export const BANKABLE_PERKS = {
  // Think On It (Technician/Grandmaster Focus, 5th level, p.103): "as a Free action, you can
  // grant yourself an Edge on one Skill Test before the beginning of your next turn."
  [`${GI_JOE_CRB}M7HNdhqViy0xbUkz`]: { flagKey: 'pendingThinkOnIt', target: 'self' },

  // Plan of Action (Officer base, 1st level, p.85): "as a Move action, you can grant an ally
  // within line of sight [shiftN] to a Skill Test on their next turn." "Line of sight" is
  // approximated as "any ally on the current scene" - this system has no line-of-sight
  // calculation anywhere to check against. The higher-level "split the total across two allies"
  // half isn't automated either - this always grants the Perk's own full current advance value
  // to one chosen ally, a simpler (and more common in play) case of the same grant.
  [`${GI_JOE_CRB}7wsu99k8v620IB2N`]: { flagKey: 'pendingPlanOfAction', target: 'ally' },
};

/**
 * Whether the sheet should show a "Use" control for this Perk item right now - it's one of the
 * table above, and there isn't already an unspent banked bonus from it.
 * @param {Item} item
 * @returns {Boolean}
 */
export function canUsePerk(item) {
  const actor = item?.parent;
  if (!actor || item.type != 'perk') {
    return false;
  }

  const sourceId = item.flags?.core?.sourceId ?? item._stats?.compendiumSource;
  const bankable = BANKABLE_PERKS[sourceId];
  if (!bankable) {
    return false;
  }

  const targetActor = bankable.target == 'self' ? actor : null;
  return targetActor ? !getPendingBonus(targetActor, bankable.flagKey) : true;
}

/**
 * Prompts for which nearby ally to bank a Perk's bonus on - defaults to a single already-targeted
 * token (the same "auto-detect, player confirms" idiom Sneak Attack's own checkbox uses) and
 * falls back to a plain picker dialog otherwise.
 * @param {Actor} actor   The actor using the Perk (not the one who'll receive the bonus).
 * @returns {Promise<Actor|null>}   null if there's no ally to pick, or the picker was cancelled.
 */
async function pickAllyTarget(actor) {
  const targetedAllies = Array.from(game.user.targets ?? [])
    .map(token => token.actor)
    .filter(a => a && a != actor);
  if (targetedAllies.length == 1) {
    return targetedAllies[0];
  }

  const allies = getNearbyAllyTokens(actor, Infinity).map(token => token.actor).filter(Boolean);
  if (!allies.length) {
    ui.notifications.warn(game.i18n.localize('E20.PlanOfActionNoAllies'));
    return null;
  }

  const options = allies.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  const chosenId = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.PlanOfActionPickAllyTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.PlanOfActionPickAllyLabel')
    }</label><select name="allyId">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.allyId.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  if (!chosenId || chosenId == 'cancel') {
    return null;
  }

  return allies.find(a => a.id == chosenId) ?? null;
}

/**
 * Banks whichever bonus the given Perk grants - called from the sheet's own "Use" click.
 * @param {Item} item   The Perk item being used.
 */
export async function onPerkUse(item) {
  const actor = item?.parent;
  const sourceId = item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource;
  const bankable = BANKABLE_PERKS[sourceId];
  if (!actor || !bankable) {
    return;
  }

  let targetActor = actor;
  if (bankable.target == 'ally') {
    targetActor = await pickAllyTarget(actor);
    if (!targetActor) {
      return;
    }
  }

  const data = bankable.flagKey == 'pendingPlanOfAction'
    ? { shiftUp: item.system.advances?.currentValue || 1 }
    : { edge: true };

  await bankPendingBonus(targetActor, bankable.flagKey, data);
  ui.notifications.info(game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: targetActor.name }));
}
