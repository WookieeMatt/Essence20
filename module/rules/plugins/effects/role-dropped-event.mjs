// Rules-engine plug-ins, round 17 (split3 - docs/rules-batches/slSplit317.md): the roleDropped Trigger event.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: sheet-handlers/role-handler.mjs loads it lazily.
import { registerEvent } from "../../types.mjs";

/**
 * Trigger event `roleDropped` - a Role was dropped on the actor and its training (armor / weapon Qualified and Trained)
 * is applied (sheet-handlers/role-handler.mjs#onRoleDrop, at its very end). Fired on every Trigger the actor holds for it,
 * once per item copy. It's Morphin Time!'s `refreshMorphedToughness`: the Morphed Toughness bonus follows the new Armor
 * Training.
 */
registerEvent('roleDropped');

/**
 * Fire the actor's roleDropped Triggers.
 * @param {Actor} actor
 */
export async function fireRoleDropped(actor) {
  if (!actor) {
    return;
  }

  const { fireTriggers } = await import("../../triggers.mjs");
  await fireTriggers(actor, 'roleDropped');
}
