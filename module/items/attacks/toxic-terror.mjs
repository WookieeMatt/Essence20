import { getUses } from "../../mechanics/resources/scene-clock.mjs";

/**
 * Toxic Terror (Finster's Monster-Matic Cookbook, Path of Venom, 13th level). The Use button and the unarmed-hit stacking
 * are the Perk's own rules now (a markWindow on `toxicTerrorActive`, and a hit Trigger adding one `toxicTerrorStacks`
 * use on the target per unarmed hit). What stays here is the reader: the target's own Strength / Speed Skill Tests take
 * one downshift per stack this scene (dice.mjs, before the Roll Options Dialog) - a scene-clock window record, so a new
 * scene reads it as zero again.
 */
const TOXIC_TERROR_STACKS_FLAG = 'toxicTerrorStacks';

/**
 * The target's stacked downshift from this scene's Toxic Terror hits.
 * @param {Actor} targetActor
 * @returns {Number}
 */
export function getToxicTerrorShiftDown(targetActor) {
  return targetActor ? getUses(targetActor, TOXIC_TERROR_STACKS_FLAG, 'scene') : 0;
}
