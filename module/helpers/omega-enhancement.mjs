import { getNearbyEnemyTokens } from "./enemies.mjs";
import { E20 } from "./config.mjs";

/**
 * Omega Enhancement (Form) (Across the Stars, General Perk, p.70, prerequisite: maximum Personal
 * Power 6+): "You do not need to spend additional resources when you activate 'It's Morphin
 * Time!' but must choose this as your Form... At the beginning of your turn while Morphed, spend
 * 1 Personal Power to adjust the throttle on your Omega Morpher for one of the following
 * benefits" - Table's own 7-option catalog (Blast/Charged-Up/Electro/Hyper/Light Beam/Muscle/
 * Power Mode).
 *
 * Built 6 of 7 (all but Hyper Mode - "gain one extra Move and two extra Free actions this turn"
 * needs the confirmed-absent action-economy/per-turn-budget tracking this project has flagged
 * project-wide - excluded from the picker entirely, the same "don't offer a choice with nothing
 * behind it" idiom Grid Surge's own 4th option/Jury Rig's own Improve Aerodynamics already
 * established). Muscle Mode's own "and carrying capacity" clause is dropped the same way - no
 * encumbrance/carrying-capacity system exists anywhere in this codebase.
 *
 * The 3 Attack modes (Blast/Electro/Light Beam) share one Absolute-Menace-style shape (auto- or
 * manually-targeted, trigger a real interactive roll via actor._dice.rollSkill() with a synthetic
 * dataset, Targeting vs. Evasion, damage/Condition applied in dice.mjs's own post-hit processing -
 * same "non-weaponEffect Skill Test that still feeds the ordinary Apply Damage pipeline" shape
 * Psychoanalyst/Explosive Morph/Supreme Guardian already established) differing only in target
 * selection and payload: Blast Mode auto-targets every enemy within 50ft (RAW's own 10x10ft area
 * is dropped for the simpler "everyone nearby" shape, the same "drop the geometry, keep the
 * target-based mechanic" idiom this project already uses broadly); Electro Mode lets the player
 * manually target up to 2 enemies (RAW's own "two ADJACENT enemies" has no adjacency-pair
 * auto-detection anywhere to build against, so the player is trusted to pick a sensible pair) and
 * ignores armor (getDefenseValue's own ignoreArmor option, generic across any defenseType); Light
 * Beam Mode is a plain single-target Attack (whichever token is currently targeted) applying
 * Blinded on a hit, the same toggleStatusEffect shape Absolute Menace/Elemental Storm already use.
 *
 * The 3 self-buff modes (Charged-Up/Muscle/Power) all last "until the end of your turn"/"until
 * the beginning of your next turn" - reusing Psycho Assault's own "repurpose hasUsedThisTurn's
 * used-already semantics as a still-valid-this-turn check" idiom, hand-rolled here (rather than
 * calling hasUsedThisTurn/markUsedThisTurn directly) since each needs an extra payload field
 * (which Essence/skill the bonus applies to) those two generic helpers have no room for.
 */

export const OMEGA_ENHANCEMENT_OPTIONS = ['blast', 'chargedUp', 'electro', 'lightBeam', 'muscle', 'power'];
const OMEGA_ENHANCEMENT_OPTION_LABELS = {
  blast: 'E20.OmegaEnhancementOptionBlast',
  chargedUp: 'E20.OmegaEnhancementOptionChargedUp',
  electro: 'E20.OmegaEnhancementOptionElectro',
  lightBeam: 'E20.OmegaEnhancementOptionLightBeam',
  muscle: 'E20.OmegaEnhancementOptionMuscle',
  power: 'E20.OmegaEnhancementOptionPower',
};

const CHARGED_UP_FLAG = 'omegaEnhancementChargedUpThisTurn';
const MUSCLE_FLAG = 'omegaEnhancementMuscleThisTurn';
const POWER_FLAG = 'omegaEnhancementPowerThisTurn';

/**
 * @returns {Promise<{option: String, essence: String|null}|null>}   essence is only meaningful
 *   for Charged-Up Mode. null if cancelled.
 */
export async function pickOmegaEnhancementOption() {
  const options = OMEGA_ENHANCEMENT_OPTIONS
    .map(key => `<option value="${key}">${game.i18n.localize(OMEGA_ENHANCEMENT_OPTION_LABELS[key])}</option>`)
    .join('');
  const essenceOptions = Object.keys(E20.essences)
    .filter(key => key != 'any')
    .map(key => `<option value="${key}">${game.i18n.localize(E20.essences[key])}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.OmegaEnhancementPickOptionTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.OmegaEnhancementPickOptionLabel')
    }</label><select name="option">${options}</select></div>
    <div class="form-group"><label>${
  game.i18n.localize('E20.OmegaEnhancementPickEssenceLabel')
}</label><select name="essence">${essenceOptions}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => ({
          option: button.form.elements.option.value,
          essence: button.form.elements.essence.value,
        }),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

function stampTurnFlag(actor, flagKey, extra = {}) {
  return actor.setFlag('essence20', flagKey, {
    combatId: game.combat?.id ?? null,
    round: game.combat?.round ?? null,
    turn: game.combat?.turn ?? null,
    ...extra,
  });
}

function isTurnFlagActive(actor, flagKey) {
  const flag = actor?.getFlag?.('essence20', flagKey);
  if (!flag) {
    return null;
  }

  const stillThisTurn = game.combat
    ? (flag.combatId == game.combat.id && flag.round == game.combat.round && flag.turn == game.combat.turn)
    : true;
  return stillThisTurn ? flag : null;
}

/**
 * Whichever Essence Charged-Up Mode is currently boosting, if still within the same turn it was
 * activated. Read from rollSkill()'s own self-status section.
 * @param {Actor} actor
 * @returns {String|null}
 */
export function getChargedUpEssence(actor) {
  return isTurnFlagActive(actor, CHARGED_UP_FLAG)?.essence ?? null;
}

/**
 * Whether Muscle Mode's own ↑3 Brawn is still active.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isMuscleModeActive(actor) {
  return !!isTurnFlagActive(actor, MUSCLE_FLAG);
}

/**
 * Whether Power Mode's own Edge on Might is still active.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isPowerModeActive(actor) {
  return !!isTurnFlagActive(actor, POWER_FLAG);
}

/**
 * Prompts for a mode (and, for Charged-Up Mode, an Essence), spends 1 Personal Power, and applies
 * the chosen benefit - triggering a real roll for the 3 Attack modes, or stamping a turn-scoped
 * flag for the 3 self-buff modes.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}   False if cancelled or unaffordable, true once applied/rolled.
 */
export async function activateOmegaEnhancement(actor) {
  if ((actor.system.powers?.personal?.value ?? 0) < 1) {
    return false;
  }

  const choice = await pickOmegaEnhancementOption();
  if (!choice) {
    return false;
  }

  await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });

  if (choice.option == 'chargedUp') {
    await stampTurnFlag(actor, CHARGED_UP_FLAG, { essence: choice.essence });
    return true;
  }

  if (choice.option == 'muscle') {
    await stampTurnFlag(actor, MUSCLE_FLAG);
    return true;
  }

  if (choice.option == 'power') {
    await stampTurnFlag(actor, POWER_FLAG);
    return true;
  }

  if (choice.option == 'blast') {
    const enemies = getNearbyEnemyTokens(actor, 50);
    canvas.tokens.setTargets(enemies.map(token => token.id));
  }

  await actor._dice.rollSkill({
    skill: 'targeting', essence: 'speed', shiftUp: 0, shiftDown: 0, defenseType: 'evasion',
    omegaEnhancementMode: choice.option,
  }, actor);
  return true;
}
