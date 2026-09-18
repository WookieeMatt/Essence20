/**
 * Monster... Grow! (Finster's Monster-Matic Cookbook, Sorcerous Power, p.274): "Turn an allied
 * Threat from Normal to Grown version as a combined Standard and Move action."
 *
 * Two behaviours, in order of preference:
 *
 *  1. **If the Threat has a linked Grown form** - a separate Actor built by the Grow dialog
 *     (apps/monster-grow-dialog.mjs), cross-linked by the `grownFormId`/`normalFormId` flags -
 *     the targeted TOKEN is swapped to it, which is what the Power actually describes: the books
 *     model a Grown form as its own stat block, not a modified one. See
 *     helpers/monster-grow-swap.mjs.
 *  2. **Otherwise**, the original fallback: flip this actor's own `system.size` to Gigantic (the
 *     classic PR "kaiju-scale monster" reading, matching the size Megazords/Zords are built to
 *     fight), saving the original Size so toggling back off restores it exactly. Any other
 *     Size-dependent stat change RAW might imply (Health, damage, Defenses) is not named in this
 *     book's own short effect text, so nothing beyond the Size field is touched.
 *
 * A correction to this file's earlier note: changing `system.size` DOES resize placed tokens -
 * Essence20Actor#_preUpdate calls resizeTokens() on every Size change - so the fallback has always
 * had a visual effect on the canvas. The claim that it did not was wrong.
 */
import { canSwapTokenForm, swapTokenForm } from './monster-grow-swap.mjs';

const MONSTER_GROW_FLAG = 'monsterGrowOriginalSize';
const GROWN_SIZE = 'gigantic';

/**
 * Toggles Grown on whichever token is currently targeted.
 *
 * Prefers swapping the targeted token to its linked Grown/Normal form when one exists (see this
 * file's own doc comment); falls back to the Size-only toggle otherwise, so every Threat nobody
 * has built a Grown form for keeps working exactly as before.
 *
 * @param {Actor} _actor   The caster - unused for the effect itself (RAW targets an allied Threat,
 *   not the caster), kept only for a consistent onPowerUse dispatch signature.
 * @returns {Promise<Boolean|Actor|null>}   The swapped-to Actor, or the new Size-toggle state, or
 *   null if nothing is targeted.
 */
export async function activateMonsterGrow(_actor) {
  const target = game.user.targets.first();
  if (!target) {
    return null;
  }

  if (canSwapTokenForm(target.document)) {
    return await swapTokenForm(target.document);
  }

  return await toggleMonsterGrow(target.actor);
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
