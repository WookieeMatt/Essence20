/**
 * GI Joe CRB p.94 - the Renegade Role's signature Reckless Abandon Role Points Item:
 * while active and in light or no armor, ↑2 on Strength tests and bonus Health from the Role table.
 *
 * The Bonus Health half, the per-day Uses resource pool, and the Active/Activatable toggle
 * itself are ALL already fully generic - Reckless Abandon is an ordinary `healthBonus` Role
 * Points Item (isActivatable: true), and documents/actor.mjs's own _prepareHealth() already
 * folds an active healthBonus grant's per-level value into health.max, exactly the same way
 * defenseBonus Role Points already worked before Personal Shield's own "already built" correction
 * this session. Only the conditional Strength Skill Test upshift below needed new code - nothing
 * generic reads an Essence while one specific Role Points item is Active, gated on armor.
 *
 * Correction: this used to add the bonus as a flat +2 to the roll's numeric modifier instead of
 * 2 upshifts - the PDF's own up-shift glyph is lost by plain-text extraction (renders as blank
 * space before the number), the same misreading a live bug report already caught once for
 * Expertise's own "gaining [up-shift]2" text. Fixed to apply via shiftUp instead, matching
 * Beast of Burden/Alert/Silent Weapon Expertise's own (already-correct) shape.
 */

const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
const RECKLESS_ABANDON_ID = `${GI_JOE_CRB}84d0XTJwKCYMJUgY`;
// The ↑2 on Strength Skill Tests in light or no armor is a RollModifier rule on the Role Points item itself (round 17,
// rules/conv17-split2.test.js); Hardened (Tank Focus, 1st level) adds its own in Medium armor (rules/conv14-items2.test.js).

/**
 * Whether the given Role Points Item is GI Joe's own Reckless Abandon grant specifically (not just
 * any healthBonus Role Points Item) - a plain sourceId check, independent of its current isActive
 * state.
 * @param {Item} rolePoints
 * @returns {Boolean}
 */
function isRecklessAbandonItem(rolePoints) {
  if (!rolePoints) {
    return false;
  }

  const sourceId = rolePoints.flags?.core?.sourceId ?? rolePoints._stats?.compendiumSource ?? rolePoints?.flags?.essence20?.rulesSource;
  return sourceId == RECKLESS_ABANDON_ID;
}

/**
 * Whether the given actor's base Role Points Item is specifically GI Joe's Reckless Abandon grant
 * (not just any healthBonus Role Points Item - Power Rangers/My Little Pony have their own), and
 * it's currently switched on via the sheet's existing Active toggle.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isRecklessAbandonActive(actor) {
  const rolePoints = actor._getBaseRolePoints?.();
  return isRecklessAbandonItem(rolePoints) && !!rolePoints.system.isActive;
}
