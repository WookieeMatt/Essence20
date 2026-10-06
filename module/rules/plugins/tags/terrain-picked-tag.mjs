import { registerTag } from "../../predicate.mjs";
import { lazy } from "../shared/lazy-helpers-and-targets.mjs";

/**
 * Round 15 (items2): `terrain:picked:<key>` - the scene's terrain where the actor stands (mechanics/world/environment.mjs
 * #getTerrain) is one of the values a pick (`pickMany` / `pick` from config environments) stored on the rule's item
 * under `key`. False with no terrain set or nothing picked (pair it with a `not:terrain:set` switch for untagged scenes).
 * Environmental Enforcer's chosen environments.
 */
export function terrainPickedTag(rest, ctx) {
  const stored = ctx?.ruleItem?.flags?.essence20?.rules?.choices?.[rest];
  const list = Array.isArray(stored) ? stored : stored ? [stored] : [];
  let terrain = null;
  try {
    terrain = lazy.getTerrain?.(ctx?.self) ?? null;
  } catch (error) {
    terrain = null;
  }

  return !!terrain && list.includes(terrain);
}

registerTag('terrain:picked', terrainPickedTag, { phrase: ['you are in the terrain you picked', "you aren't in the terrain you picked"] });
