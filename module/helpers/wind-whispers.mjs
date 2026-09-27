import { pickSelfOrTeamMember } from "./team-member-picker.mjs";

export const WIND_WHISPERS_ID = "Compendium.essence20.beneath_the_helmet.Item.JZgbPpDoFXctLBoH";

/**
 * Wind Whispers (Beneath the Helmet, Aqua Ranger, Grid Science I choice, p.41): "You learn or
 * teach one of your allies to feel the disturbances in the air of an incoming attack. This
 * increases their Evasion by 2. This Grid Science can be chosen once per team member." A
 * permanent +2 Evasion grant that can land on yourself OR a chosen teammate - see
 * helpers/team-member-picker.mjs's own doc comment for why this needs a build-time (not
 * scene-based) picker. system.defenses.evasion.bonus is a real, already-live input field
 * _prepareDefenses() folds in (confirmed via Charge Into Battle's own identical +2 Evasion Active
 * Effect), safe to write directly even on a PC-type target.
 * @param {Actor} caster   The Aqua Ranger who was just granted this Perk instance.
 */
export async function grantWindWhispersEvasion(caster) {
  const target = await pickSelfOrTeamMember(caster, 'Wind Whispers');
  if (!target) {
    return;
  }

  await target.update({ 'system.defenses.evasion.bonus': (target.system.defenses.evasion.bonus ?? 0) + 2 });
}
