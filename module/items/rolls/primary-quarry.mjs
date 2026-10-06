/**
 * Primary Quarry (Decepticon Directive, Tracker Focus, 1st level, p.55): "You may choose a single
 * creature... to make your Primary Quarry by spending 1 hour studying information about them or
 * researching their travels. You gain [up 1] on Skill Tests to track and find your Primary
 * Quarry, whether or not they are in the scene. The bonus from Mark Target stacks with this bonus
 * if you designate your Primary Quarry at the beginning of a scene as your mark."
 *
 * Same "plain designation flag + a Use button" shape as items/rolls/mark-target.mjs's own
 * MARK_TARGET_FLAG - the 1-hour research cost is unenforced narrative (this project's own
 * standard idiom for a time cost nothing tracks against, see items/rolls/trade-school.mjs), and "you
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
 * Designates the actor's currently-targeted token as their Primary Quarry.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   False (and no flag set) if nothing is targeted.
 */
export async function designatePrimaryQuarry(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.PrimaryQuarryNoTarget'));
    return false;
  }

  await actor.setFlag('essence20', PRIMARY_QUARRY_FLAG, targetActor.uuid);
  return true;
}

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

  // Secondary Mark (Decepticon Directive, Tracker, 10th level, p.56): "you can choose two creatures
  // to be your Primary Quarry with the same hour of research. Both creatures count as your Primary
  // Quarry for your Tracker Focus Perks." The second is set with that Perk's Use button
  // (mechanics/combat/target-riders.mjs).
  return actor?.getFlag?.('essence20', PRIMARY_QUARRY_FLAG) == target.uuid
    || (actor?.getFlag?.('essence20', 'secondaryQuarryUuid') == target.uuid
      && !!actor.items?.some?.(item => (item.flags?.core?.sourceId ?? item._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource) == SECONDARY_MARK_ID));
}
