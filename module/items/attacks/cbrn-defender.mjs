/**
 * CBRN Defender Hang-Up (Ferocious Fighters, New Influence, p.76): "Your focus on protecting
 * others has made it more difficult for you to employ lethal tactics in combat without feeling
 * remorse. When you use an option that Defeats a living creature through damage, such as by
 * attacking them, you suffer -1 on attack rolls for the rest of that scene as you dwell on the
 * consequences of your actions." (RAW confirmed via a direct PDF re-extraction after the cached
 * text-linearization dropped this exact passage across a 2-column page break - see
 * scratchpad/page79_items.txt from this session.)
 *
 * Detected in chat.mjs#onApplyDamage (the one place both the attacker and the post-damage target
 * Health are known at once) - "Defeats... through damage" is read as the target's own Health
 * actually reaching 0 as a direct result of THIS damage application (previousHealth > 0, new
 * health <= 0), covering both an ordinary Health-subtraction hit and a Stun hit that pushes total
 * Stun past remaining Health (applyDamage's own auto-Defeat branch) - not just a literal
 * "Defeated" status toggle, since ordinary (non-Stun) damage reaching 0 Health never auto-toggles
 * that status anywhere in this codebase (a GM does it manually).
 *
 * "For the rest of that scene" is approximated as "the rest of the current combat" (this system's
 * own closest scene-boundary proxy, the same idiom Stand Behind Me!/Team Focus's own round/combat-
 * scoped flags already use) - a PERSISTENT live-read shiftDown (checked on every subsequent attack
 * roll, not a one-shot consumed bank), since RAW applies it to every attack for the remainder of
 * the scene, not just the next one.
 */
const CBRN_DEFENDER_HANG_UP_ID = "Compendium.essence20.ferocious_fighters.Item.B6HYPvLAVgCtQk1n";
const CBRN_DEFENDER_FLAG = 'cbrnDefenderShiftDownActive';

/**
 * @param {Actor} attacker
 */
export async function markCbrnDefenderTriggered(attacker) {
  await attacker.setFlag('essence20', CBRN_DEFENDER_FLAG, { combatId: game.combat?.id ?? null });
}

/**
 * @param {Actor} actor
 * @returns {Number}   1 while the debuff is active this scene, else 0.
 */
export function getCbrnDefenderShiftDown(actor) {
  const pending = actor.getFlag?.('essence20', CBRN_DEFENDER_FLAG);
  if (!pending) {
    return 0;
  }

  return pending.combatId === (game.combat?.id ?? null) ? 1 : 0;
}

export { CBRN_DEFENDER_HANG_UP_ID };
