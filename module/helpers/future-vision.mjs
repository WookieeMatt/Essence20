/**
 * Future Vision (A Jump Through Time, Grid Power, p.57): "You may spend up to 3 Personal Power at
 * the beginning of any scene to have access to a Skill Test re-roll during that scene for each
 * Personal Power spent. If your re-roll results in a failure, it is downgraded into a Fumble,
 * regardless of the actual dice results."
 *
 * Only the resource half is built: activating writes the actual amount spent directly to this
 * item's own system.reroll.maxUses (the same "a Power can rewrite its own schema fields on click"
 * idiom Speed Boost's disabled-effect-enable already established), then enables the grant - the
 * generic reroll engine (helpers/reroll.mjs) already tracks usage per its own reset bucket (here,
 * "scene" - keyed by the current Foundry Scene's own id, a closer match to RAW's own "during that
 * scene" wording than the encounter-scoped approximation this project uses elsewhere), so writing a
 * fresh maxUses at each activation correctly lets a re-activation later in the same scene "top up"
 * remaining uses rather than double-counting. The "downgrade a failed reroll to Fumble" clause
 * needs a new hook into the reroll engine's own outcome-consumption step (distinct from the
 * resource/usage-count mechanism itself) and isn't built - flagged as a gap, not silently dropped.
 */

/**
 * @param {Item} item          The Future Vision Power item itself.
 * @param {Number} amountSpent How much Power was spent on this activation (1-3 per RAW; the
 *   variable-cost picker's own maxPowerCost already enforces that cap).
 */
export async function activateFutureVision(item, amountSpent) {
  if (!amountSpent) {
    return;
  }

  await item.update({
    'system.reroll.enabled': true,
    'system.reroll.maxUses': amountSpent,
  });
}
