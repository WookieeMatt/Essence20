/**
 * Fight Me! (Beneath the Helmet, Graphite Ranger, 2nd level, p.46 - replaces Danger Sense): "You
 * may choose a Threat that you can see. This Threat suffers a downshift 1 on Attack Skill Tests
 * against any target other than yourself. You may only use this Perk against one Threat at a
 * time, but you may change which Threat this applies to at the end of each of your turns."
 *
 * Marks whichever token is currently targeted (the same "auto-detect via targets" idiom Mark
 * Target/Splinter Defense already use) - overwriting any earlier mark, matching RAW's own "one
 * Threat at a time." The downshift is read directly in dice.mjs#_getAutomaticCombatModifiers's
 * per-target block: when the MARKED creature (not the marking Ranger) is the one rolling an
 * Attack, and the roll's own target isn't the Ranger who marked them, they suffer the downshift.
 * "You may change... at the end of each of your turns" has no active enforcement beyond simply
 * re-marking - the same "approximate, don't hard-enforce every clause" idiom this project already
 * accepts elsewhere.
 */
const FIGHT_ME_FLAG = 'fightMeMarkedBy';

/**
 * Marks the currently-targeted token as this actor's own Fight Me! Threat.
 * @param {Actor} actor   The Graphite Ranger using the Perk.
 * @returns {Promise<Boolean>}   True if a target was found and marked.
 */
export async function markFightMe(actor) {
  const targetToken = game.user.targets.first();
  const target = targetToken?.actor;
  if (!target) {
    return false;
  }

  await target.setFlag('essence20', FIGHT_ME_FLAG, actor.id);
  return true;
}

/**
 * Whether the given (attacking) actor should suffer Fight Me!'s own downshift on this Attack -
 * true when they're currently marked by someone AND the roll's own target isn't that marker.
 * @param {Actor} actor   The one rolling the Attack (potentially the marked Threat).
 * @param {Actor} target   Who this specific Attack is aimed at.
 * @returns {Boolean}
 */
export function checkFightMeDownshift(actor, target) {
  const markedBy = actor.getFlag?.('essence20', FIGHT_ME_FLAG);
  return !!markedBy && markedBy != target?.id;
}
