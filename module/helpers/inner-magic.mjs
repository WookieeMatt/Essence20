import { getSceneEpoch } from "./scene-clock.mjs";

/**
 * Inner Magic (MLP CRB, Magic Role Perk, 2nd level, p.94): "As a Standard action, you can reduce
 * your Willpower Defense by 1 until the end of the scene to upshift ↑1 your Spellcasting for your
 * next action. You may do this multiple times in a scene."
 *
 * The ↑1 Spellcasting half is already built (helpers/banked-buffs.mjs's own BANKABLE_PERKS entry,
 * consumed in dice.mjs's own _getAutomaticCombatModifiers). This file covers the other half: a
 * stacking, scene-scoped Willpower Defense reduction - one more point off for every activation
 * this same scene, read back by documents/actor.mjs#_prepareInnerMagicWillpowerReduction (the
 * same "computed live in prepareDerivedData, not persisted as a raw stat edit" idiom every other
 * derived Defense/Health adjustment in this codebase already uses).
 */
export const INNER_MAGIC_ID = "Compendium.essence20.mlp_crb.Item.E6GWRHzP9tOAxQP6";

const WILLPOWER_REDUCTION_FLAG = 'innerMagicWillpowerReduction';

/**
 * Adds one more stacked point to this scene's Willpower Defense reduction - called every time
 * Inner Magic is activated, alongside (not instead of) the existing BANKABLE_PERKS shiftUp grant.
 * @param {Actor} actor
 */
export async function stackInnerMagicWillpowerReduction(actor) {
  const epoch = getSceneEpoch();
  const current = actor.getFlag?.('essence20', WILLPOWER_REDUCTION_FLAG);
  const count = current?.epoch === epoch ? current.count + 1 : 1;
  await actor.setFlag('essence20', WILLPOWER_REDUCTION_FLAG, { epoch, count });
}

/**
 * How many points of Willpower Defense reduction are currently stacked this scene - 0 if none, or
 * if the flag is stale (a scene that has since ended).
 * @param {Actor} actor
 * @returns {Number}
 */
export function getInnerMagicWillpowerReduction(actor) {
  const flag = actor?.getFlag?.('essence20', WILLPOWER_REDUCTION_FLAG);
  return flag?.epoch === getSceneEpoch() ? flag.count : 0;
}
