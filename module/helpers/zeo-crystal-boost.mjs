import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Zeo Crystal Boost (Across the Stars, Grid Power, p.73): "Once per scene, as a Standard action,
 * spend 2 Personal Power and use your Zeo crystal to gain a benefit based on the item in which you
 * insert your Zeo crystal.
 * - Into your Morpher: Gain upshift 1 on unarmed Attacks and +1 to all Defenses until the end of
 *   the scene.
 * - Into your Power Weapon: Your Power Weapon inflicts 1 additional Energy damage with each strike
 *   until the end of the scene.
 * - Into your Zord: Gain upshift 1 to Driving (Zord) Skill Tests until the end of the scene, or
 *   increase damage on a single successful Zord Attack by 2."
 *
 * A one-time pick (which item the crystal goes into) that then lasts "until the end of the
 * scene" - modeled as a one-way flag activation (no toggle-off), the same idiom
 * helpers/augment-power-weapon.mjs's own doc comment already establishes for Powers generally (no
 * "this click means turn it back off" concept in the generic Power click flow). Built: the Morpher
 * option's both clauses, and the Power Weapon option. NOT built: the Zord option (both its own
 * Driving-shiftUp and single-Zord-Attack-damage-+2 sub-choices) - Driving (Zord) Skill Tests are
 * rolled by the PILOT while seated in the Zord (same crew/pilot infra as Repair Zord), which is
 * buildable in principle but wasn't reached this pass; the team-wide Megaform group bonus clause
 * ("if every member of your team has this Grid Power...") needs a per-team aggregate check with no
 * existing precedent. Both flagged as gaps, not silently dropped.
 */
const ZEO_CRYSTAL_BOOST_FLAG = 'zeoCrystalBoostOption';
const ZEO_CRYSTAL_BOOST_ENCOUNTER_FLAG = 'zeoCrystalBoostUsedThisEncounter';

/**
 * Prompts for which item the crystal is inserted into.
 * @returns {Promise<'morpher'|'weapon'|null>}   null if cancelled. The Zord option isn't offered -
 *   see this file's own doc comment on why it isn't built (the "don't offer a choice with nothing
 *   behind it" idiom pickHobbleCondition/pickDefenseType/pickGridSurgeOption already follow).
 */
export async function pickZeoCrystalBoostOption() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ZeoCrystalBoostPickOptionTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.ZeoCrystalBoostPickOptionLabel')
    }</label><select name="option">
      <option value="morpher">${game.i18n.localize('E20.ZeoCrystalBoostMorpher')}</option>
      <option value="weapon">${game.i18n.localize('E20.ZeoCrystalBoostWeapon')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.option.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

export function canUseZeoCrystalBoost(actor) {
  return !hasUsedThisEncounter(actor, ZEO_CRYSTAL_BOOST_ENCOUNTER_FLAG);
}

/**
 * @param {Actor} actor
 * @param {'morpher'|'weapon'} option
 */
export async function activateZeoCrystalBoost(actor, option) {
  await actor.setFlag('essence20', ZEO_CRYSTAL_BOOST_FLAG, option);
  await markUsedThisEncounter(actor, ZEO_CRYSTAL_BOOST_ENCOUNTER_FLAG);
}

export function getZeoCrystalBoostOption(actor) {
  return actor.getFlag?.('essence20', ZEO_CRYSTAL_BOOST_FLAG) ?? null;
}
