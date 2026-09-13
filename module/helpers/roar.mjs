import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";
import { E20 } from "./config.mjs";

/**
 * Roar! (Ferocious Fighters, Tiger Force Faction Perk): "Once per combat, as a Free action, gain
 * +1 to a Defense that lasts until the end of the combat scene." A self-only, banked flat Defense
 * bonus - same live, non-consumed "can't touch _prepareDefenses" shape as Lightshield Armor/
 * Bolster Defense's own single-Defense mode, just self-targeted and dispatched directly via a
 * "Use" button (no roll to trigger - RAW itself is a plain Free-action activation, not a Skill
 * Test). "Until the end of the combat scene" has no active clearing hook (this codebase has no
 * scene-boundary event) - the once-per-combat gate (hasUsedThisEncounter) both caps re-use AND
 * naturally bounds the bonus to roughly "this combat," the same "approximate an unenforceable
 * duration" idiom Bolster Defense's own identical clause already accepts.
 */
const ROAR_ENCOUNTER_FLAG = 'roarUsedThisEncounter';
const ROAR_FLAG = 'roarActive';

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseRoar(actor) {
  return !!game.combat && !hasUsedThisEncounter(actor, ROAR_ENCOUNTER_FLAG);
}

/**
 * @returns {Promise<String|null>}   The chosen Defense key, or null if cancelled.
 */
async function pickRoarDefenseType() {
  const options = Object.keys(E20.defenses)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.defenses[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.RoarPickDefenseTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.RoarPickDefenseLabel')
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
 * Prompts for which Defense, then banks it - once per combat.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   False if not usable or the picker was cancelled.
 */
export async function activateRoar(actor) {
  if (!canUseRoar(actor)) {
    return false;
  }

  const defenseType = await pickRoarDefenseType();
  if (!defenseType) {
    return false;
  }

  await actor.setFlag('essence20', ROAR_FLAG, { defenseType, combatId: game.combat.id });
  await markUsedThisEncounter(actor, ROAR_ENCOUNTER_FLAG);
  return true;
}

/**
 * The live, non-consumed Defense bonus Roar! grants against the given Defense comparison (0 if
 * nothing is banked, it's a stale prior combat, or it doesn't apply to this Defense).
 * @param {Actor} actor
 * @param {String} defenseType
 * @returns {Number}
 */
export function getRoarDefenseBonus(actor, defenseType) {
  const pending = actor.getFlag?.('essence20', ROAR_FLAG);
  if (!pending || pending.defenseType != defenseType || pending.combatId != game.combat?.id) {
    return 0;
  }

  return 1;
}
