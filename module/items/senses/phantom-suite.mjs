import { findPerk } from "../../mechanics/characters/perks.mjs";

/**
 * Phantom Suite (Across the Stars, Phantom Ranger, 1st/7th/12th/17th level, p.60): while Morphed,
 * 1 Personal Power makes the Ranger semi-invisible until damaged by an attack on Evasion; meanwhile
 * ↑1 and Edge on Infiltration (Stealth) and +2/3/4/5 Evasion by level.
 *
 * An on/off toggle costing Power to switch ON (same shape as Power Boost/Power Adaptation), but
 * with one difference: it also switches itself back OFF automatically the first time an Evasion-
 * compared attack actually lands (deactivatePhantomSuite, called from dice.mjs#_rollSkillHelper's
 * own post-hit processing) - unlike every other manual on/off toggle in this project, RAW gives
 * this one a real, checkable end condition, so it's worth honoring rather than leaving to the
 * player to notice and toggle off themselves.
 *
 * The Infiltration shiftUp+Edge half is read directly in dice.mjs#rollSkill's self-status section
 * (same shape as Crushing Strength's essence-agnostic skill check). The Evasion Defense bonus
 * can't be added in documents/actor.mjs#_prepareDefenses (out of bounds - see the user's own
 * pending Health/Defense-math migration), so it's added the same way Grid Surge's Toughness
 * Boost/Resilience/Hard Target already work around that: as a live (non-consumed, re-checked every
 * attack) addition to the TARGET's own difficulty in dice.mjs#rollSkill's per-target checkEntries
 * construction, the same "read on someone ELSE's roll" call site, just without ever clearing a
 * flag since this bonus applies repeatedly for as long as the toggle stays on (not a one-shot bank
 * like consumeResilience/consumeHardTarget).
 */
const PHANTOM_SUITE_FLAG = 'phantomSuiteActive';
const PHANTOM_SUITE_ID = "Compendium.essence20.across_the_stars.Item.fQgxo5c7tNOD2Q5K";

export function isPhantomSuiteActive(actor) {
  return !!actor.getFlag?.('essence20', PHANTOM_SUITE_FLAG);
}

/**
 * Forces Phantom Suite off with no Power refund - called once a successful Evasion-compared
 * Attack actually lands on the holder (see this file's own doc comment above). A no-op if it
 * wasn't active in the first place.
 * @param {Actor} actor
 */
export async function deactivatePhantomSuite(actor) {
  if (isPhantomSuiteActive(actor)) {
    await actor.setFlag('essence20', PHANTOM_SUITE_FLAG, false);
  }
}

/**
 * The actor's own current Phantom Suite Evasion Defense bonus (+2 at 1st level, scaling to +5 by
 * 17th, read live from the Perk item's own advances.currentValue) - 0 if the actor doesn't hold
 * the Perk at all (shouldn't normally happen if isPhantomSuiteActive is true, but checked
 * defensively since the two are read independently at different call sites).
 * @param {Actor} actor
 * @returns {Number}
 */
export function getPhantomSuiteEvasionBonus(actor) {
  return findPerk(actor, PHANTOM_SUITE_ID)?.system.advances?.currentValue ?? 0;
}
