import {
  actorHasPerk, bankPendingBonus, clearPendingBonus, getPendingBonus, hasUsedThisEncounter, markUsedThisEncounter,
} from "./perks.mjs";
import { getNearbyAllyTokens } from "./allies.mjs";
import { E20 } from "./config.mjs";

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

// Inspiration (Officer/Battlefield Psychologist Focus, 17th level, p.86): "when you use Plan of
// Action, you can affect one additional ally and grant one upshift 1 above your normal total.
// This is cumulative with the increase to Plan of Action at 18th level." Modifies an EXISTING
// bankable grant rather than being one of its own, so it's detected in onPerkUse() below instead
// of getting a 3rd BANKABLE_PERKS entry - it only ever matters for Plan of Action (Think On It's
// own self-only grant has no analogous "one more target" upgrade).
const INSPIRATION_ID = `${GI_JOE_CRB}j05tN97KZNzl5jTF`;

// Roll With the Punches (Renegade/Tank Focus, 6th level, p.97): "Once per combat, you can double
// your Toughness, Willpower, or Evasion against one attack or effect." Unlike Think On
// It/Plan of Action, this one is limited-use (RAW's own "once per combat," gated at the moment of
// use via hasUsedThisEncounter/markUsedThisEncounter below - not at consumption, since the
// resource being spent is "declaring the double," not "successfully doubling something") and
// needs a choice at bank time (which Defense to protect) - see needsDefenseChoice/onceEncounterFlag
// on its own BANKABLE_PERKS entry below, and pickDefenseType()/consumeRollWithThePunches() further
// down. Consumption happens on someone ELSE's roll (whoever attacks this actor), not this actor's
// own next roll, so it's read directly in dice.mjs's checkEntries construction (where a target's
// Defense difficulty is actually computed) rather than _getAutomaticCombatModifiers's self-status
// section every other banked bonus above uses.
const ROLL_WITH_THE_PUNCHES_ID = `${GI_JOE_CRB}5hBral7hiCPv3GqF`;
const ROLL_WITH_THE_PUNCHES_ENCOUNTER_FLAG = 'rollWithThePunchesUsedThisEncounter';
export const PENDING_ROLL_WITH_THE_PUNCHES_FLAG_KEY = 'pendingRollWithThePunches';

// Perk -> { flagKey, target }. target 'self' banks the bonus directly on the actor using the
// Perk; target 'ally' prompts for which nearby ally to bank it on instead (see pickAllyTarget
// below) - Plan of Action's own text is "grant an ally", not "grant yourself." needsDefenseChoice/
// onceEncounterFlag are Roll With the Punches-specific, see its own doc comment above.
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

  [ROLL_WITH_THE_PUNCHES_ID]: {
    flagKey: PENDING_ROLL_WITH_THE_PUNCHES_FLAG_KEY,
    target: 'self',
    needsDefenseChoice: true,
    onceEncounterFlag: ROLL_WITH_THE_PUNCHES_ENCOUNTER_FLAG,
  },
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

  if (bankable.onceEncounterFlag && hasUsedThisEncounter(actor, bankable.onceEncounterFlag)) {
    return false;
  }

  const targetActor = bankable.target == 'self' ? actor : null;
  return targetActor ? !getPendingBonus(targetActor, bankable.flagKey) : true;
}

/**
 * Prompts for which nearby ally/allies to bank a Perk's bonus on - defaults to whichever tokens
 * are already targeted (the same "auto-detect, player confirms" idiom Sneak Attack's own
 * checkbox uses), as long as there are between 1 and maxCount of them, and falls back to a plain
 * single-ally picker dialog otherwise. The dialog only ever picks one, even when maxCount is 2
 * (Inspiration's own "one additional ally") - a multi-select dialog isn't built, so reaching the
 * 2nd-ally case without it requires actually targeting 2 tokens first.
 * @param {Actor} actor   The actor using the Perk (not the one/ones who'll receive the bonus).
 * @param {Number} maxCount   The most allies this use can target at once (1 normally, 2 with
 *   Inspiration).
 * @returns {Promise<Array<Actor>>}   Empty if there's no ally to pick, or the picker was
 *   cancelled.
 */
async function pickAllyTargets(actor, maxCount = 1) {
  const targetedAllies = Array.from(game.user.targets ?? [])
    .map(token => token.actor)
    .filter(a => a && a != actor);
  if (targetedAllies.length >= 1 && targetedAllies.length <= maxCount) {
    return targetedAllies;
  }

  const allies = getNearbyAllyTokens(actor, Infinity).map(token => token.actor).filter(Boolean);
  if (!allies.length) {
    ui.notifications.warn(game.i18n.localize('E20.PlanOfActionNoAllies'));
    return [];
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
    return [];
  }

  const chosen = allies.find(a => a.id == chosenId);
  return chosen ? [chosen] : [];
}

/**
 * Prompts for which Defense (Toughness, Willpower, or Evasion) Roll With the Punches should
 * protect - see its own BANKABLE_PERKS entry above. Cleverness isn't offered; RAW only names
 * these three.
 * @returns {Promise<String|null>}   One of 'toughness'/'willpower'/'evasion', or null if
 *   cancelled.
 */
async function pickDefenseType() {
  const options = ['toughness', 'willpower', 'evasion']
    .map(key => `<option value="${key}">${game.i18n.localize(E20.defenses[key])}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.RollWithThePunchesPickDefenseTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.RollWithThePunchesPickDefenseLabel')
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

  const isPlanOfAction = bankable.flagKey == 'pendingPlanOfAction';
  const hasInspiration = isPlanOfAction && actorHasPerk(actor, INSPIRATION_ID);
  const baseValue = item.system.advances?.currentValue || 1;
  const grantValue = hasInspiration ? baseValue + 1 : baseValue;

  let targetActors = [actor];
  if (bankable.target == 'ally') {
    targetActors = await pickAllyTargets(actor, hasInspiration ? 2 : 1);
    if (!targetActors.length) {
      return;
    }
  }

  let data = isPlanOfAction ? { shiftUp: grantValue } : { edge: true };
  if (bankable.needsDefenseChoice) {
    const defenseType = await pickDefenseType();
    if (!defenseType) {
      return;
    }

    data = { defenseType };
  }

  for (const targetActor of targetActors) {
    await bankPendingBonus(targetActor, bankable.flagKey, data);
  }

  if (bankable.onceEncounterFlag) {
    await markUsedThisEncounter(actor, bankable.onceEncounterFlag);
  }

  const names = targetActors.map(a => a.name).join(', ');
  ui.notifications.info(game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: names }));
}

/**
 * Reads back a target's own pending Roll With the Punches bank (see its own BANKABLE_PERKS entry
 * above) and, if it matches the Defense actually being compared, consumes it. Called from the
 * ATTACKER's own rollSkill() while building each target's checkEntries difficulty - the one
 * banked effect in this file that's read on someone ELSE's roll rather than the banking actor's
 * own next one.
 * @param {Actor} targetActor   The actor being attacked (not the attacker).
 * @param {String} defenseType   The Defense this attack is actually being compared against.
 * @returns {Promise<Boolean>}   True if a matching bank was found and consumed.
 */
export async function consumeRollWithThePunches(targetActor, defenseType) {
  const pending = getPendingBonus(targetActor, PENDING_ROLL_WITH_THE_PUNCHES_FLAG_KEY);
  if (!pending || pending.defenseType != defenseType) {
    return false;
  }

  await clearPendingBonus(targetActor, PENDING_ROLL_WITH_THE_PUNCHES_FLAG_KEY);
  return true;
}
