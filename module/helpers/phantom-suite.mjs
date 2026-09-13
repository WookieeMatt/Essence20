import { findPerk } from "./perks.mjs";

/**
 * Phantom Suite (Across the Stars, Phantom Ranger, 1st/7th/12th/17th level, p.60): "While Morphed,
 * spend 1 Personal Power to become semi-invisible. You remain in this semi-invisible state until
 * you take damage from an Attack against your Evasion Defense. While the Phantom Suite is active,
 * you gain ↑1 and Edge to all Infiltration (Stealth) Skill Tests and a +[2/3/4/5, by level] bonus
 * to your Evasion Defense."
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
 * Flips Phantom Suite on/off. Turning it ON spends 1 Personal Power (returns null, spending
 * nothing, if the actor can't afford it); turning it back OFF (manually, or via
 * deactivatePhantomSuite below) is free.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}
 */
export async function togglePhantomSuite(actor) {
  const nowActive = !isPhantomSuiteActive(actor);
  if (nowActive) {
    if (actor.system.powers.personal.value < 1) {
      return null;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
  }

  await actor.setFlag('essence20', PHANTOM_SUITE_FLAG, nowActive);
  return nowActive;
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
