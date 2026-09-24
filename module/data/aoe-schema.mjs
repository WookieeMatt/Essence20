import { E20 } from "../helpers/config.mjs";

import { makeNum, makeStrWithChoices } from "./generic-makers.mjs";

/**
 * The Area of Effect schema, shared between WeaponEffectItemData (module/data/item/weapon-effect.mjs),
 * SpellItemData (module/data/item/spell.mjs) and PowerItemData (module/data/item/power.mjs) - a
 * Blast/AoE weapon quality, an area spell and an area Power all place the same shape by the same
 * rules, so all three need the exact same two fields. Factored out here rather than copy-pasted a
 * third time, the same reasoning rerollSchema() (module/data/reroll-schema.mjs) already applies to
 * the reroll grant shared between Perks and ActiveEffects.
 *
 * `shape` deliberately stores Foundry's OWN region shape type names (see E20.aoeShapes in
 * helpers/config.mjs) rather than a system-flavoured vocabulary of its own, so the value passes
 * straight through to canvas.regions.placeRegion() with no translation table in between - see
 * helpers/aoe-targeting.mjs. Null for an ordinary single-target or Multiple-Targets attack with no
 * AoE shape at all.
 *
 * `radius` is in feet (this system's own grid unit - every other radius/range field in this
 * codebase is already in feet) and is deliberately makeNum, not makeInt: Explosive Beam's own "15ft
 * diameter circle" (MLP CRB p.137) is a 7.5ft radius, and rounding that to 8 would silently widen
 * the spell.
 * @returns {Object}   A plain object of schema fields, spread into the caller's own defineSchema().
 */
export const aoeSchema = () => ({
  shape: makeStrWithChoices(Object.keys(E20.aoeShapes), null),
  radius: makeNum(0),
});
