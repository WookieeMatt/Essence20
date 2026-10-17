import { itemsOf } from "../../items/shared/item-lookups.mjs";

/**
 * Terrain/environment-dependent derived data: an item's Defense / DerivedStat / Movement rule whose condition reads
 * where the token stands (the exposure clothes among them) catches up as soon as the token walks into or out of a
 * Region - same trigger as environment.mjs's own refresh.
 */

// A Defense / DerivedStat / Movement rule whose condition reads where the token stands (a terrain, an
// environment, or one of the position checks of items/shared/situation-checks.mjs) - prepared with the actor, so it needs the same
// refresh on a Region change (the exposure clothes' Defense rules among them).
const POSITION_TAG = /\b(?:terrain|environment):|\bcheck:(?:inWater|onLand|seaOrWetlands|aboardAquaticVessel|completeDarkness)\b/;
const PREPARED_RULES = ['Defense', 'DerivedStat', 'Movement'];

export function hasPositionRules(actor) {
  return itemsOf(actor).some(item => (Array.isArray(item?.system?.rules) ? item.system.rules : [])
    .some(rule => PREPARED_RULES.includes(rule?.type) && POSITION_TAG.test(JSON.stringify(rule.when ?? []))));
}

if (typeof Hooks != 'undefined') {
  Hooks.on?.('updateToken', (tokenDoc, changes) => {
    const actor = tokenDoc?.actor;
    if (changes && '_regions' in changes
      && hasPositionRules(actor)) {
      actor.reset?.();
      if (actor.sheet?.rendered) {
        actor.sheet.render();
      }
    }
  });
}
