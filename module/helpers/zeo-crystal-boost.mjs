import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";
import { getMegaformParticipants } from "./megaform-participants.mjs";
import { getVehicleDriver } from "./combat.mjs";

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
 * option's both clauses, the Power Weapon option, and (2026-09-14) the Zord option's both own
 * sub-choices - flattened into the same picker as 'zordDriving'/'zordAttackDamage' rather than a
 * nested second dialog, matching the "flatten category+specific into one key" idiom Defensive
 * Flexibility's own option list already established. 'zordDriving' persists for the rest of the
 * scene like the Morpher/Weapon options (checked in dice.mjs's self-status section against the
 * PILOT's own Driving roll, gated on actually piloting a Zord); 'zordAttackDamage' is a single-use
 * +2, consumed the moment it's applied to a Zord's own weaponEffect roll (the same "the attempt
 * itself consumes the resource, not the hit" idiom Unseen Strike/Augment Power already use) via
 * the new ZEO_CRYSTAL_BOOST_ZORD_ATTACK_CONSUMED_FLAG below - resolved from the ZORD's own roll
 * via _getVehicleDriver, the same White Ranger Prime already established for a Zord's own Attacks.
 * Team-wide Megaform clause (2026-09-24): "If every member of your team has this Grid Power while
 * piloting your team's Megaform, you may all insert your Zeo crystal pieces to add 1 damage to all
 * Megaform Zord Attacks until the end of the scene." Modeled as a 5th flattened option
 * ('megaformTeam') alongside the personal ones above - each Ranger activates their own copy the
 * same way, and helpers/megaform-participants.mjs's own "who currently makes up this Megaform"
 * resolution (already shared by combiner-timer.mjs/megaform-damage.mjs) is reused to check, at
 * roll time, whether EVERY Zord participant's own current driver has that option active right now
 * - see isZeoCrystalBoostMegaformTeamActive below, consumed in dice.mjs's own damage-bonus sum
 * alongside Auxiliary Zord/Thunder Upgrade.
 */
const ZEO_CRYSTAL_BOOST_FLAG = 'zeoCrystalBoostOption';
const ZEO_CRYSTAL_BOOST_ENCOUNTER_FLAG = 'zeoCrystalBoostUsedThisEncounter';
const ZEO_CRYSTAL_BOOST_ZORD_ATTACK_CONSUMED_FLAG = 'zeoCrystalBoostZordAttackConsumed';

/**
 * Prompts for which item the crystal is inserted into.
 * @returns {Promise<'morpher'|'weapon'|'zordDriving'|'zordAttackDamage'|'megaformTeam'|null>}
 *   null if cancelled.
 */
export async function pickZeoCrystalBoostOption() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ZeoCrystalBoostPickOptionTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.ZeoCrystalBoostPickOptionLabel')
    }</label><select name="option">
      <option value="morpher">${game.i18n.localize('E20.ZeoCrystalBoostMorpher')}</option>
      <option value="weapon">${game.i18n.localize('E20.ZeoCrystalBoostWeapon')}</option>
      <option value="zordDriving">${game.i18n.localize('E20.ZeoCrystalBoostZordDriving')}</option>
      <option value="zordAttackDamage">${game.i18n.localize('E20.ZeoCrystalBoostZordAttackDamage')}</option>
      <option value="megaformTeam">${game.i18n.localize('E20.ZeoCrystalBoostMegaformTeam')}</option>
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
 * @param {'morpher'|'weapon'|'zordDriving'|'zordAttackDamage'|'megaformTeam'} option
 */
export async function activateZeoCrystalBoost(actor, option) {
  await actor.setFlag('essence20', ZEO_CRYSTAL_BOOST_FLAG, option);
  await actor.setFlag('essence20', ZEO_CRYSTAL_BOOST_ZORD_ATTACK_CONSUMED_FLAG, false);
  await markUsedThisEncounter(actor, ZEO_CRYSTAL_BOOST_ENCOUNTER_FLAG);
}

export function getZeoCrystalBoostOption(actor) {
  return actor.getFlag?.('essence20', ZEO_CRYSTAL_BOOST_FLAG) ?? null;
}

/**
 * The team-wide Megaform clause's own live check - see this file's own top comment. True only when
 * the Megaform actually has at least one linked Zord AND every one of them currently has a driver
 * seated who has chosen the 'megaformTeam' option (i.e. every team member really did insert their
 * crystal, not just some of them - RAW's own "if EVERY member" is read literally). A driverless
 * participant (nobody currently seated) fails this the same way a missing Grid Power would, since
 * there's no Ranger there to have made the choice at all.
 * @param {Actor} megaformActor
 * @returns {Boolean}
 */
export function isZeoCrystalBoostMegaformTeamActive(megaformActor) {
  if (megaformActor?.type != 'megaform' || !megaformActor.system?.subtype?.includes?.('megaformZord')) {
    return false;
  }

  const participants = getMegaformParticipants(megaformActor);
  if (!participants.length) {
    return false;
  }

  return participants.every(zord => {
    const driver = getVehicleDriver(zord);
    return !!driver && getZeoCrystalBoostOption(driver) == 'megaformTeam';
  });
}

/**
 * The 'zordAttackDamage' sub-choice's own single-use gate - true only once, on the pilot's Zord's
 * first successful-or-not weaponEffect roll after the option was chosen (see this file's own doc
 * comment for why the attempt itself, not the hit, is what consumes it).
 * @param {Actor} pilotActor   The PILOT holding the Grid Power (not the Zord doing the rolling).
 * @returns {Boolean}   Whether the +2 should apply to this roll.
 */
export function consumeZeoCrystalBoostZordAttackDamage(pilotActor) {
  if (getZeoCrystalBoostOption(pilotActor) != 'zordAttackDamage'
    || pilotActor.getFlag?.('essence20', ZEO_CRYSTAL_BOOST_ZORD_ATTACK_CONSUMED_FLAG)) {
    return false;
  }

  pilotActor.setFlag('essence20', ZEO_CRYSTAL_BOOST_ZORD_ATTACK_CONSUMED_FLAG, true);
  return true;
}
