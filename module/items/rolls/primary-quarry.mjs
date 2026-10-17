/**
 * Primary Quarry (Decepticon Directive, Tracker Focus, 1st level, p.55): an hour of research makes
 * one creature the Quarry; ↑1 on tests to track and find it, in the scene or not, stacking with Mark
 * Target when the Quarry is also the scene's mark.
 *
 * Same "plain designation flag + a Use button" shape as items/rolls/mark-target.mjs's own
 * MARK_TARGET_FLAG - the 1-hour research cost is unenforced narrative (this project's own
 * standard idiom for a time cost nothing tracks against), and "you
 * gain upshift 1 on Skill Tests to track and find" is approximated as "any roll against the
 * designated creature", the exact same widening Mark Target's own doc comment in dice.mjs already
 * accepts for its nearly-identical "Skill Tests related to that creature" text - RAW explicitly
 * calls out that the two bonuses stack, which only makes sense if they're read the same way.
 * Independent of Mark Target's own flag (a Perk can hold both, and RAW's stacking clause requires
 * it), and of Studious Measures' own targeting-only "Use" button (items/senses/studious-measures.mjs) -
 * that Perk's doc comment declined to build this base mechanic just for its own sake; this file
 * builds it because Primary Quarry's own upshift is worth automating regardless.
 */

const PRIMARY_QUARRY_FLAG = 'primaryQuarryUuid';
const SECONDARY_MARK_ID = "Compendium.essence20.decepticon_directive.Item.GS8YX7V6rYJLnkfQ";

/**
 * Whether the given target is the actor's currently-designated Primary Quarry.
 * @param {Actor} actor
 * @param {Actor} target
 * @returns {Boolean}
 */
export function checkPrimaryQuarry(actor, target) {
  if (!target?.uuid) {
    return false;
  }

  // Secondary Mark (Decepticon Directive, Tracker, 10th level, p.56): one hour of research sets two
  // Quarries, both counting for the Tracker Focus Perks. The second is set with that Perk's Use button
  // (mechanics/combat/target-riders.mjs).
  return actor?.getFlag?.('essence20', PRIMARY_QUARRY_FLAG) == target.uuid
    || (actor?.getFlag?.('essence20', 'secondaryQuarryUuid') == target.uuid
      && !!actor.items?.some?.(item => (item.flags?.core?.sourceId ?? item._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource) == SECONDARY_MARK_ID));
}
