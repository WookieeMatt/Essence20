import { pickSelfOrTeamMember } from "./team-member-picker.mjs";

export const SURVIVAL_TRAINING_ID = "Compendium.essence20.beneath_the_helmet.Item.xOhVWGL1lHJaVdqI";

/**
 * Survival Training (Beneath the Helmet, Aqua Ranger, Grid Science III choice, p.42): "You or one
 * member of your Power Ranger team gains 1 Health. This Grid Science may be chosen multiple
 * times, once per team member." Previously a compendium Active Effect on system.health.bonus,
 * which only ever covered the self case (a transfer:true effect always applies to whoever holds
 * the item, with no way to redirect it to a different actor when the player picks a teammate
 * instead) - replaced with this dispatch so both cases share one code path, the same "no
 * cross-actor equivalent of the compendium-effect approach" reasoning Wind Whispers' own identical
 * shape already established.
 * @param {Actor} caster   The Aqua Ranger who was just granted this Perk instance.
 */
export async function grantSurvivalTrainingHealth(caster) {
  const target = await pickSelfOrTeamMember(caster, 'Survival Training');
  if (!target) {
    return;
  }

  await target.update({ 'system.health.bonus': (target.system.health.bonus ?? 0) + 1 });
}
