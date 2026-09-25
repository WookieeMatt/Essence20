/**
 * "Infiltrating" - a plain on/off actor flag, the same manual-toggle idiom
 * helpers/environmental-expertise.mjs and helpers/dig-in.mjs already establish for a stance this
 * codebase has no automatic way to detect (this system tracks no scene/terrain/action-in-progress
 * state at all). Shared by both Shadow and Silent Strider (GI Joe CRB, Infiltrator Focus, p.75),
 * which each key off the SAME "while you are Infiltrating" state:
 *
 * - Shadow (1st/10th level): "Those who attempt to detect you when you are Infiltrating suffer
 *   ↓2 shifts." (The paired "+1 Speed Essence at 1st/10th level, invested in Infiltration" is a
 *   plain Essence Score Increase, already covered by this project's generic Role-advancement
 *   grant - nothing Shadow-specific to build there.)
 * - Silent Strider (10th level): "those who attempt to detect you while using Infiltration suffer
 *   a Snag on their Alertness Skill Tests." A narrower restatement of the same idea, scoped to
 *   Alertness specifically rather than "any shift."
 *
 * Either Perk's own sheet "Use" button flips the same shared toggle - holding both just means two
 * buttons doing the same thing, which is harmless.
 */
const INFILTRATING_FLAG = 'infiltratingActive';

export function isInfiltrating(actor) {
  return !!actor.getFlag?.('essence20', INFILTRATING_FLAG);
}

/**
 * Flips the actor's own Infiltrating stance. Returns the new state (true = now Infiltrating).
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function toggleInfiltrating(actor) {
  const nowInfiltrating = !isInfiltrating(actor);
  await actor.setFlag('essence20', INFILTRATING_FLAG, nowInfiltrating);
  return nowInfiltrating;
}
