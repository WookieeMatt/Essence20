import { getUsesThisScene, hasUsedThisEncounter, markUsedThisEncounter, markUsedThisScene } from "./perks.mjs";
import { getNearbyAllyTokens } from "./allies.mjs";

/**
 * Not Dead Yet (Factions in Action Vol. 2, CSTO Personnel Origin Perk, p.70): "Once per scene,
 * you may gain 1 temporary Health as a Standard action. Once per adventure, if another character
 * with the CSTO Personnel Origin can see and hear you, you gain 2 temporary Health instead."
 *
 * RE-CATEGORIZED - previously tagged "no below-zero-Health special-state mechanism," conflated by
 * name with GI Joe CRB's own, unrelated "Not Done Yet" (a real Defeat-prevention clamp already
 * built - see combat.mjs). Real RAW here is a plain temporary-Health grant, the same
 * system.health.bonus/.value ADD shape Got To Get Tough's own identical grant already establishes
 * - "can see and hear you" approximated as the same 30ft radius idiom Got To Get Tough itself
 * uses for the exact same RAW phrase. "Once per scene" uses this project's own real Scene-keyed
 * primitive (getUsesThisScene/markUsedThisScene) rather than the usual once-per-encounter
 * approximation, since RAW's own wording matches that primitive exactly; "once per adventure" has
 * no matching primitive in this codebase, so it's approximated down to once-per-encounter, the
 * same idiom every other "per day/session" resource already uses.
 */
const NOT_DEAD_YET_ID = "Compendium.essence20.intercontinental_adventures.Item.mCsw25hT4y4q4ceG";
const CSTO_PERSONNEL_ID = "Compendium.essence20.intercontinental_adventures.Item.3u2UV58RvzyoId4Q";
const NOT_DEAD_YET_SCENE_FLAG = 'notDeadYetUsedThisScene';
const NOT_DEAD_YET_ENHANCED_ENCOUNTER_FLAG = 'notDeadYetEnhancedUsedThisEncounter';
const ALLY_RADIUS_FEET = 30;

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseNotDeadYet(actor) {
  return getUsesThisScene(actor, NOT_DEAD_YET_SCENE_FLAG) < 1;
}

/**
 * Whether a nearby ally holds the CSTO Personnel Origin - checked against the parent Origin
 * Item's own sourceId, the same flags.core.sourceId-vs-_stats.compendiumSource dual check this
 * project's own weaponSourceId lookups already establish.
 * @param {Actor} actor
 * @returns {Boolean}
 */
function _hasNearbyCstoPersonnel(actor) {
  return getNearbyAllyTokens(actor, ALLY_RADIUS_FEET).some(token => {
    const ally = token.actor;
    return !!ally?.items?.some?.(item => {
      const sourceId = item.flags?.core?.sourceId ?? item._stats?.compendiumSource;
      return item.type == 'origin' && sourceId == CSTO_PERSONNEL_ID;
    });
  });
}

/**
 * Grants 1 temporary Health (or 2, if a nearby CSTO Personnel ally is present and the once-per-
 * adventure upgrade hasn't been spent yet), and marks this scene's use.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether it actually fired.
 */
export async function activateNotDeadYet(actor) {
  if (!canUseNotDeadYet(actor)) {
    return false;
  }

  let amount = 1;
  if (_hasNearbyCstoPersonnel(actor) && !hasUsedThisEncounter(actor, NOT_DEAD_YET_ENHANCED_ENCOUNTER_FLAG)) {
    amount = 2;
    await markUsedThisEncounter(actor, NOT_DEAD_YET_ENHANCED_ENCOUNTER_FLAG);
  }

  await actor.update({
    'system.health.bonus': actor.system.health.bonus + amount,
    'system.health.value': actor.system.health.value + amount,
  });
  await markUsedThisScene(actor, NOT_DEAD_YET_SCENE_FLAG);
  return true;
}

export { NOT_DEAD_YET_ID };
