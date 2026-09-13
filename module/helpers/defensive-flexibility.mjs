/**
 * Defensive Flexibility (A Jump Through Time, Blue Spectrum Modification, replaces Grid Tech,
 * p.45): "Starting when this Perk is acquired, then again every 5 Role Levels gained, you may
 * choose one of the following benefits to permanently apply to your character: +2 bonus to any
 * single Defense while Morphed (not an armor bonus); Resistance to any element of damage." Same
 * "pick once permanently, repeatable via multiple instances" shape as Power Adaptation/Phantom
 * Focus - a new `defensiveFlexibility` choiceType (sheet-handlers/perk-handler.mjs) builds one
 * flat 11-option list (4 Defenses + 7 Element sub-types, see E20.defensiveFlexibilityOptions)
 * combining both of RAW's own categories, since a single Perk instance's own system.choice can
 * only hold one value. Both halves are live, non-consumed checks (can't touch _prepareDefenses/
 * applyDamage's own resistance grant directly - the user's own pending Health/Defense-math
 * migration, and Resistance itself is expressed as a Snag on the attacker's roll, not a flat
 * reduction, in this codebase's own model) - see this file's own two read functions, consumed
 * directly in dice.mjs alongside Stronger Together (the Defense bonus) and Lance of Light (the
 * Resistance-as-Snag check).
 */
const DEFENSIVE_FLEXIBILITY_ID = "Compendium.essence20.pr_crb.Item.7kHQ53hZFgwhSFVi";

/**
 * Whether the actor picked the given Defensive Flexibility option on ANY held instance - unlike
 * findPerk()'s single-match lookup, this checks every instance, since selectionLimit:1 per
 * instance but the Perk itself is repeatable (a fresh instance every 5 Role Levels).
 * @param {Actor} actor
 * @param {String} option   One of E20.defensiveFlexibilityOptions' own keys.
 * @returns {Boolean}
 */
export function hasDefensiveFlexibilityOption(actor, option) {
  return !!actor?.items?.some(item => {
    const sourceId = item.flags?.core?.sourceId ?? item._stats?.compendiumSource;
    return sourceId == DEFENSIVE_FLEXIBILITY_ID && item.system.choice == option;
  });
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The live, non-consumed +2 Defense bonus for the given Defense type, while Morphed.
 * @param {Actor} actor
 * @param {String} defenseType
 * @returns {Number}
 */
export function getDefensiveFlexibilityDefenseBonus(actor, defenseType) {
  if (!defenseType || !actor?.system?.isMorphed) {
    return 0;
  }

  return hasDefensiveFlexibilityOption(actor, `defense${capitalize(defenseType)}`) ? 2 : 0;
}

/**
 * Whether the actor is Resistant to the given damage type via Defensive Flexibility - checked
 * alongside the target's own static system.resistances field, the same "live check parallel to
 * the static field" shape Lance of Light's own toggled Resistance already establishes.
 * @param {Actor} actor
 * @param {String} damageType
 * @returns {Boolean}
 */
export function hasDefensiveFlexibilityResistance(actor, damageType) {
  if (!damageType) {
    return false;
  }

  return hasDefensiveFlexibilityOption(actor, `resistance${capitalize(damageType)}`);
}
