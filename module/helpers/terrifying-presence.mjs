import { actorHasPerk } from "./perks.mjs";

/**
 * Terrifying Presence (GI Joe Core Rulebook, General Perk, p.134-135; prerequisite Intimidation
 * d6): "Intimidation is a Social Essence skill for you in addition to a Strength Essence skill.
 * When you use Intimidation as an Attack against a Target's Willpower Defense, you may either:
 * Inflict 1 additional damage / Inflict the Frightened Condition to cause the target to flee for
 * one round / Stun the target for one round."
 *
 * The Social-Essence half is already built (this Perk's own compendium Item carries an Active
 * Effect setting system.skills.intimidation.essences.social) - this file is only the second half.
 *
 * Unlike Growl/Frightening Display (helpers/growl.mjs, helpers/frightening-display.mjs), each a
 * single dedicated action with its own button, Terrifying Presence is a standing rider on ANY
 * Intimidation Attack against Willpower - Growl, Frightening Display, Menace, or a bare manual
 * Skill Test all qualify equally, so this is detected generically off the roll's own resolved
 * skill/defenseType/Perk rather than a synthetic per-ability flag. Resolved once, up front, inside
 * dice.mjs#rollSkill itself (not item.mjs, since several of its own triggers - Growl included -
 * call actor._dice.rollSkill() directly with no Item at all) via the same "pre-roll DialogV2
 * picker" idiom as Bring It All Down's own pickBringItAllDownEffect. The "+1 damage" option folds
 * into damageBonusValue before the roll; the Frightened/Stunned options are applied post-hit, the
 * same "checkContext flag read in the post-hit results loop" shape Absolute Menace/Frightening
 * Display's own isXAttempt flags already use.
 */
const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
export const TERRIFYING_PRESENCE_ID = `${GI_JOE_CRB}Uw1jdm5GzW7Nk5Wi`;

/**
 * @param {Actor} actor
 * @param {String} rolledSkill
 * @param {String} defenseType   The dataset's own pre-dialog defenseType (Growl/Frightening
 *   Display both set it explicitly; a manual Attack sets it via its own dropdown/dataset).
 * @returns {Promise<String|null>}   One of 'damage'/'frightened'/'stun', or null if this roll
 *   doesn't qualify, the player declined, or the dialog was cancelled.
 */
export async function pickTerrifyingPresenceRider(actor, rolledSkill, defenseType) {
  if (rolledSkill != 'intimidation' || defenseType != 'willpower' || !actorHasPerk(actor, TERRIFYING_PRESENCE_ID)) {
    return null;
  }

  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.TerrifyingPresencePickTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.TerrifyingPresencePickLabel')
    }</label><select name="effect">
      <option value="none">${game.i18n.localize('E20.BringItAllDownOptionNone')}</option>
      <option value="damage">${game.i18n.localize('E20.TerrifyingPresenceOptionDamage')}</option>
      <option value="frightened">${game.i18n.localize('E20.TerrifyingPresenceOptionFrightened')}</option>
      <option value="stun">${game.i18n.localize('E20.TerrifyingPresenceOptionStun')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.effect.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' && chosen != 'none' ? chosen : null;
}
