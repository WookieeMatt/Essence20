import { roleValueChange } from "../sheet-handlers/role-handler.mjs";

/**
 * Meat Shield (Sgt Slaughter Sourcebook, Alternate Vanguard Role Perk, p.14-15): "As a Free
 * action, you gain a temporary deflection bonus to your Toughness and Evasion until the beginning
 * of your next turn. The bonus you gain is equal to the Personal Shield Benefit column on Table
 * 5-28: Vanguard in the G.I. JOE Roleplaying Game core rulebook. Ignore the Personal Shield Uses
 * column. At 7th level, you gain a permanent +2 deflection bonus to Toughness and Evasion. At 12th
 * level, this increases to +3, and at 20th level, this increases to +4. This bonus does not stack
 * with the temporary benefits you gain from Meat Shield as a Free action."
 *
 * Meat Shield REPLACES the Vanguard's own Personal Shield Role Perk, so its own holder never has
 * a real Personal Shield rolePoints Item to read the "Benefit column" from (unlike Shield Upgrade,
 * which extends an actor's OWN active Personal Shield - see helpers/personal-shield.mjs). The
 * progression is instead hardcoded here directly from that table's own known values
 * (startingValue 2, +1 at levels 3/5/7/9/11/13/15/17, level20Value 15) via the same
 * roleValueChange computation Splinter Defense's identical Hardened-Armor-bonus lookup already
 * uses for a genuinely different Role's own scaling rolePoints Item.
 *
 * Can't touch `_prepareDefenses` (the user's own pending Health/Defense-math migration - see
 * [[essence20-active-effects]]), so - like Phantom Suite/Powered Plating's own Toughness/Evasion
 * bonuses - both halves are live, non-consumed reads in dice.mjs's own per-target checkEntries
 * construction, applied as the LARGER of the two (RAW's own "does not stack") rather than added
 * together.
 *
 * Deliberately not built this pass: the 5th-level "also applies to allies within your Reach"
 * extension (would need Reach's own numeric value per Size Class, not yet needed by any other
 * Perk in this codebase) and the 13th/18th-level Resistance/Immunity-on-activation choice (needs
 * a new "pick a damage type when toggling on" mechanism, the same shape Shield Modulation already
 * has for a DIFFERENT trigger) - both flagged as real gaps, not silently dropped.
 */

const MEAT_SHIELD_ID = "Compendium.essence20.sgt_slaughter_sourcebook.Item.hYwFDsC7azfYB5fO";
const FLAG_KEY = "meatShieldActive";

const TEMP_BONUS_STARTING_VALUE = 2;
const TEMP_BONUS_INCREASE_LEVELS = ["level3", "level5", "level7", "level9", "level11", "level13", "level15", "level17"];
const TEMP_BONUS_LEVEL_20_VALUE = 15;

/**
 * Whether the actor's Meat Shield toggle is currently switched on.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isMeatShieldActive(actor) {
  return !!actor?.getFlag?.('essence20', FLAG_KEY);
}

/**
 * Switches the actor's Meat Shield toggle on or off - a Free action either direction, no cost.
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export async function toggleMeatShield(actor) {
  await actor.setFlag('essence20', FLAG_KEY, !isMeatShieldActive(actor));
}

/**
 * The temporary Free-action bonus's own current value, per Personal Shield's own Benefit column -
 * see this file's own doc comment for why the table is hardcoded rather than read from a
 * (nonexistent, for a Meat Shield holder) Personal Shield Item.
 * @param {Actor} actor
 * @returns {Number}
 */
function getTempBonus(actor) {
  if (actor.system.level == 20) {
    return TEMP_BONUS_LEVEL_20_VALUE;
  }

  return TEMP_BONUS_STARTING_VALUE + roleValueChange(actor.system.level, TEMP_BONUS_INCREASE_LEVELS);
}

/**
 * The permanent bonus - 0 below 7th level, +2/+3/+4 at 7th/12th/20th.
 * @param {Actor} actor
 * @returns {Number}
 */
function getPermanentBonus(actor) {
  if (actor.system.level >= 20) {
    return 4;
  }

  if (actor.system.level >= 12) {
    return 3;
  }

  if (actor.system.level >= 7) {
    return 2;
  }

  return 0;
}

/**
 * The actual Toughness/Evasion bonus Meat Shield grants right now - the larger of the permanent
 * bonus (always available once qualified by level) and the temporary Free-action bonus (only
 * while actually toggled on), per RAW's own "does not stack."
 * @param {Actor} actor
 * @returns {Number}   0 if the actor doesn't hold Meat Shield at all.
 */
export function getMeatShieldBonus(actor) {
  const item = actor.items?.find(actorItem =>
    actorItem.type == 'perk'
    && (actorItem.flags?.core?.sourceId == MEAT_SHIELD_ID || actorItem._stats?.compendiumSource == MEAT_SHIELD_ID));
  if (!item) {
    return 0;
  }

  const permanentBonus = getPermanentBonus(actor);
  const tempBonus = isMeatShieldActive(actor) ? getTempBonus(actor) : 0;
  return Math.max(permanentBonus, tempBonus);
}
