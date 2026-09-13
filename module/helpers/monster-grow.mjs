/**
 * Monster... Grow! (Finster's Monster-Matic Cookbook, Sorcerous Power, p.274): "Turn an allied
 * Threat from Normal to Grown version as a combined Standard and Move action."
 *
 * Only the toggle and the Size-classification change are built - "Grown" is read as this system's
 * own `system.size` field jumping to Gigantic (the classic PR "kaiju-scale monster" reading,
 * matching the size Megazords/Zords are built to fight), saving the original size so toggling back
 * off restores it exactly rather than assuming every Threat started at the same size. The actual
 * VISUAL token-scale change on the canvas (making the token bigger to look at) is NOT built - this
 * codebase has no precedent anywhere for a Perk/Power resizing a token's own canvas footprint, a
 * separate, larger piece of work than a data-field change. Any other Size-dependent stat swap RAW
 * might imply (Health, damage, Defenses) isn't named in this book's own short effect text, so
 * nothing beyond the Size field itself is touched.
 */
const MONSTER_GROW_FLAG = 'monsterGrowOriginalSize';
const GROWN_SIZE = 'gigantic';

/**
 * Toggles Grown on whichever token is currently targeted.
 * @param {Actor} _actor   The caster - unused for the effect itself (RAW targets an allied Threat,
 *   not the caster), kept only for a consistent onPowerUse dispatch signature.
 * @returns {Promise<Boolean|null>}   The new state, or null if nothing is targeted.
 */
export async function activateMonsterGrow(_actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    return null;
  }

  return await toggleMonsterGrow(targetActor);
}

export function isMonsterGrown(targetActor) {
  return !!targetActor.getFlag?.('essence20', MONSTER_GROW_FLAG);
}

/**
 * Flips the target's own Grown state - growing saves its current Size and sets it to Gigantic;
 * shrinking restores whatever Size was saved.
 * @param {Actor} targetActor
 * @returns {Promise<Boolean>}   The new state (true = now Grown).
 */
export async function toggleMonsterGrow(targetActor) {
  if (isMonsterGrown(targetActor)) {
    const originalSize = targetActor.getFlag('essence20', MONSTER_GROW_FLAG);
    await targetActor.update({ 'system.size': originalSize });
    await targetActor.unsetFlag('essence20', MONSTER_GROW_FLAG);
    return false;
  }

  await targetActor.setFlag('essence20', MONSTER_GROW_FLAG, targetActor.system.size);
  await targetActor.update({ 'system.size': GROWN_SIZE });
  return true;
}
