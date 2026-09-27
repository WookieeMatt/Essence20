/**
 * No Factor (Quartermaster's Guide to Gear, Neutralizer Focus, 20th level, p.20): "In combat, roll
 * a Deception Skill Contest against the Alertness of all enemy targets who can see you. Each
 * enemy you succeed against does not realize you are an enemy. If you attack them, any of your
 * attacks that hit are considered Critical Successes. Afterward, all enemies see through your
 * disguise."
 *
 * The Deception Skill Contest itself needs no new code - same "a Skill Contest concept doesn't
 * exist anywhere else in this codebase, so there's nothing generic to build for it" finding
 * helpers/deconstructionist.mjs's own doc comment already established: the player rolls Deception
 * with each enemy's Alertness typed in as a flat DIF (or the existing Multiple Targets mechanism,
 * for the "all enemy targets" half), same as any other Skill-Contest-shaped Perk here.
 *
 * The two genuinely NEW pieces get built here:
 * - Marking which enemies were successfully fooled - a Set of UUIDs on the ACTOR's own flag
 *   (rather than a single designee, unlike Primary Quarry/Known Accomplices' own shape), since
 *   "each enemy you succeed against" is inherently per-target and this Deception roll can already
 *   hit several at once via Multiple Targets.
 * - Forcing a later attack against a fooled enemy to Critical Success - the plain multiplier
 *   1->2 bump entry.targetUnconscious's own identical rider already uses in dice.mjs - and
 *   clearing the whole Set once any such attack actually lands ("afterward, all enemies see
 *   through your disguise," ALL of them, not just the one attacked).
 */
export const NO_FACTOR_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.FgiCtgLoTRxFXCeU";
const NO_FACTOR_FOOLED_FLAG = 'noFactorFooledUuids';

/**
 * Whether targetActor is currently fooled by the actor's No Factor disguise.
 * @param {Actor} actor
 * @param {Actor} targetActor
 * @returns {Boolean}
 */
export function isNoFactorFooled(actor, targetActor) {
  const fooled = actor?.getFlag?.('essence20', NO_FACTOR_FOOLED_FLAG) ?? [];
  return !!targetActor?.uuid && fooled.includes(targetActor.uuid);
}

/**
 * Marks a successfully-Deceived enemy as fooled, adding their uuid to the actor's own list.
 * @param {Actor} actor
 * @param {Actor} targetActor
 * @returns {Promise<void>}
 */
export async function markNoFactorFooled(actor, targetActor) {
  if (!targetActor?.uuid) {
    return;
  }

  const fooled = actor.getFlag?.('essence20', NO_FACTOR_FOOLED_FLAG) ?? [];
  if (!fooled.includes(targetActor.uuid)) {
    await actor.setFlag('essence20', NO_FACTOR_FOOLED_FLAG, [...fooled, targetActor.uuid]);
  }
}

/**
 * Clears every fooled enemy - "afterward, all enemies see through your disguise," once an attack
 * against any one of them actually lands.
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export async function clearNoFactorDisguise(actor) {
  await actor.unsetFlag('essence20', NO_FACTOR_FOOLED_FLAG);
}
