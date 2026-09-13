import { getEffectiveLevel } from "./combat.mjs";
import { getEngineOverrideTarget } from "./engine-override.mjs";
import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

export const JURY_RIG_ENCOUNTER_FLAG = 'juryRigUsedThisSceneAsStandardAction';

/**
 * Jury Rig (Factions in Action Vol. 2: Intercontinental Adventures, Engineer Troop Focus, 17th
 * level, p.73): "Once per turn, you can grant a vehicle within reach one of the following
 * benefits with a Technology Skill Test against a DIF equal to 10 + the vehicle's Threat Level."
 * Table 4-2's 7-item catalog: Align Suspension (+1 Evasion), Clean Barrels (no long-range Snag on
 * its own Attacks), Engine Turbo-Boost (Aerial Movement = Ground Movement), Harden Armor (+1
 * Toughness), Improve Aerodynamics (a "Push Yourself" Free action moves 10ft instead of 5ft),
 * Jacket Ammunition (+1 damage on one of the vehicle's Attacks), Watertight Seals (Aquatic
 * Movement = Ground Movement). "These benefits last until the end of your next turn if you make
 * the Skill Test as a Free action. Once per scene, you can use Jury Rig as a Standard action to
 * grant one of these benefits until the end of the scene."
 *
 * The once-per-scene Standard-action escalation (built 2026-09-12) reuses the exact same
 * picker/roll/apply pipeline as the base Free-action mode - only the ACTION TYPE differs, asked as
 * a second field in the same dialog, gated on hasUsedThisEncounter/markUsedThisEncounter (the
 * established once/scene-approximated-as-once/encounter idiom - unenforceable outside an active
 * Combat, the same already-accepted limitation as Adaptable/Curb Your Enthusiasm). Standard-action
 * mode banks the chosen benefit with no round-based expiry at all (an Infinity sentinel) rather
 * than Free-action mode's own "through the following round" window, matching RAW's own "until the
 * end of the scene" - the same "approximate an unenforceable duration, GM manages the edges" idiom
 * Bolster Defense's own "until end of scene" clause already uses. The base "once per turn" cap on
 * the Free-action mode itself remains unenforced, as before this change - a pre-existing
 * simplification, not something this pass revisits. Improve Aerodynamics is
 * excluded from the picker entirely - the same "don't offer a choice with nothing behind it" idiom
 * Grid Surge's own 4th option already established - since no "Push Yourself" action exists
 * anywhere in this codebase to modify (the same gap already flagged for Sewer Tunneler). Jacket
 * Ammunition is simplified to "any of the vehicle's Attacks" rather than one specific weaponEffect
 * chosen up front - avoids building a whole weapon-item sub-picker for one of six options, the
 * same kind of narrowing-to-broadening simplification this project already accepts elsewhere
 * (e.g. Fear My Name/Bits To Spare dropping an unenforceable narrative qualifier).
 *
 * Target resolution reuses helpers/engine-override.mjs's own getEngineOverrideTarget (the actor's
 * own piloted vehicle, else the currently-targeted vehicle actor) - the exact same "within reach"
 * shape this book's own Engine Override just established, no reason to duplicate it. The roll
 * itself is a flat-DIF Technology Skill Test via actor._dice.rollSkill() (the same "trigger a real
 * dialog roll, apply a chosen effect on success" shape Bolster Defense already established, with a
 * flat `dif` instead of a `defenseType` - the same unscoped-DIF shape Watchful Eyes' own DIF 10
 * Alertness check already uses), DIF computed off the TARGET vehicle's own Threat Level via the
 * same getEffectiveLevel PC-Level/NPC-Threat-Level equivalence this project already established -
 * a bigger vehicle is genuinely harder to jury-rig, matching RAW's own scaling.
 *
 * "Until the end of your next turn" is approximated to "through the end of the round after the one
 * it was granted in" (bankRound + 1) rather than the coarser single-round approximation Warrior
 * Rush/Rush the Line/Engine Override already use for their own shorter "until the beginning of
 * your next turn" clauses - Jury Rig's own duration is explicitly longer (through your NEXT turn
 * as well), so a plain single-round window would under-deliver relative to RAW. Outside of an
 * active Combat, the benefit is simply always active until manually cleared (nothing to round
 * against) - the same "approximate an unenforceable duration, GM manages the edges" idiom Bolster
 * Defense's own "until end of scene" clause already uses.
 */

const FLAG_KEY = 'pendingJuryRigBenefit';

// The 6 buildable Table 4-2 options (Improve Aerodynamics excluded - see doc comment above),
// mapped to their own flat lang.json key - this project's established convention (no nested
// localize keys anywhere in lang.json), rather than a dot-built key.
const JURY_RIG_OPTION_LABELS = {
  alignSuspension: 'E20.JuryRigOptionAlignSuspension',
  cleanBarrels: 'E20.JuryRigOptionCleanBarrels',
  engineTurboBoost: 'E20.JuryRigOptionEngineTurboBoost',
  hardenArmor: 'E20.JuryRigOptionHardenArmor',
  jacketAmmunition: 'E20.JuryRigOptionJacketAmmunition',
  watertightSeals: 'E20.JuryRigOptionWatertightSeals',
};
export const JURY_RIG_OPTIONS = Object.keys(JURY_RIG_OPTION_LABELS);

/**
 * @param {Boolean} canUseStandardAction   Whether the once-per-scene Standard-action escalation
 *   is still available this scene (false once already used) - offered as a second field in the
 *   same dialog rather than a separate prompt.
 * @returns {Promise<{option: String, standardAction: Boolean}|null>}   null if cancelled.
 */
export async function pickJuryRigOption(canUseStandardAction) {
  const options = JURY_RIG_OPTIONS
    .map(key => `<option value="${key}">${game.i18n.localize(JURY_RIG_OPTION_LABELS[key])}</option>`)
    .join('');
  const actionTypeField = canUseStandardAction
    ? `<div class="form-group"><label>${
      game.i18n.localize('E20.JuryRigPickActionTypeLabel')
    }</label><select name="actionType">
      <option value="free">${game.i18n.localize('E20.JuryRigActionTypeFree')}</option>
      <option value="standard">${game.i18n.localize('E20.JuryRigActionTypeStandard')}</option>
    </select></div>`
    : '';
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.JuryRigPickOptionTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.JuryRigPickOptionLabel')
    }</label><select name="option">${options}</select></div>${actionTypeField}`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => ({
          option: button.form.elements.option.value,
          standardAction: canUseStandardAction && button.form.elements.actionType.value == 'standard',
        }),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Prompts for the benefit (and, if still available this scene, the action type), resolves the
 * target vehicle, and triggers the flat-DIF Technology roll. The benefit itself is only banked
 * afterward, in dice.mjs's own post-roll success handling.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}   False if the picker was cancelled, null if there's no valid
 *   vehicle to target (surfaced as a warning by the caller), true once the roll is triggered.
 */
export async function activateJuryRig(actor) {
  const canUseStandardAction = !hasUsedThisEncounter(actor, JURY_RIG_ENCOUNTER_FLAG);
  const choice = await pickJuryRigOption(canUseStandardAction);
  if (!choice) {
    return false;
  }

  const vehicle = getEngineOverrideTarget(actor);
  if (!vehicle) {
    return null;
  }

  if (choice.standardAction) {
    await markUsedThisEncounter(actor, JURY_RIG_ENCOUNTER_FLAG);
  }

  const dif = 10 + getEffectiveLevel(vehicle);
  await actor._dice.rollSkill({
    skill: 'technology', essence: 'smarts', shiftUp: 0, shiftDown: 0, dif: String(dif),
    isJuryRigAttempt: true, juryRigOption: choice.option, juryRigTargetUuid: vehicle.uuid,
    juryRigStandardAction: choice.standardAction,
  }, actor);
  return true;
}

/**
 * Banks the successful roll's own chosen benefit on the target vehicle - called from dice.mjs's
 * own post-roll success handling.
 * @param {Actor} targetActor
 * @param {String} option   One of JURY_RIG_OPTIONS.
 * @param {Boolean} standardAction   True for the once-per-scene Standard-action escalation - banks
 *   with no round-based expiry ("until the end of the scene") instead of the Free-action mode's
 *   own "through the following round" window.
 */
export async function applyJuryRigBenefit(targetActor, option, standardAction = false) {
  await targetActor.setFlag('essence20', FLAG_KEY, {
    option, expiresRound: standardAction ? Infinity : (game.combat?.round ?? 0) + 1,
  });
}

/**
 * Whether the given vehicle currently has the given Jury Rig benefit active.
 * @param {Actor} targetActor
 * @param {String} option
 * @returns {Boolean}
 */
export function isJuryRigBenefitActive(targetActor, option) {
  const flag = targetActor?.getFlag?.('essence20', FLAG_KEY);
  if (!flag || flag.option != option) {
    return false;
  }

  return game.combat ? game.combat.round <= flag.expiresRound : true;
}

/**
 * The live, non-consumed Defense bonus Align Suspension/Harden Armor grant, for the given Defense
 * comparison - same shape as helpers/bolster-defense.mjs#getBolsterDefenseBonus.
 * @param {Actor} targetActor
 * @param {String} defenseType
 * @returns {Number}
 */
export function getJuryRigDefenseBonus(targetActor, defenseType) {
  if (defenseType == 'evasion' && isJuryRigBenefitActive(targetActor, 'alignSuspension')) {
    return 1;
  }

  if (defenseType == 'toughness' && isJuryRigBenefitActive(targetActor, 'hardenArmor')) {
    return 1;
  }

  return 0;
}
