import { registerTextRef } from "../../steps.mjs";

/**
 * Round 16 (part a): text `{combat.id}` - the id of the combat running now (game.combat; empty with none), for a mark's
 * `text` that a combatEnd Trigger compares with its `@var.combatId` (`self:markText:<key>=$var.combatId`): "settled when
 * the combat it was set in ends" (Hard Corps' ignored damage). Other keys are left as written.
 */
registerTextRef('combat', key => (key == 'id' ? globalThis.game?.combat?.id ?? '' : undefined));
