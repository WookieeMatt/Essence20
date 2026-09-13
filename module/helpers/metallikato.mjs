/**
 * Metallikato (Decepticon Directive, General Perk, p.66, prereq Finesse or Might d6 and
 * Specialization in blades): "When in Bot Mode, you may spend one or more Free actions to gain
 * any of the following benefits (one Free action per benefit gained) to melee attacks you make
 * in the same turn: Ignore up to your Smarts Essence in armor bonuses to Defense / Reroll all
 * Skill Die results of 1 / Shove or trip the target on a Critical Success / Gain Multiple (2)
 * Targets (↓1)."
 *
 * Four independent benefits, each its own Free action - the cost itself isn't enforced (this
 * project's own standing "no action-economy/Standard-Move-Free budget tracking" gap), same
 * accepted simplification every other Free-action-gated Perk in this codebase already lives with.
 * "Bot Mode" is `!actor.system.isTransformed` (see Daredevil/Now You Don't's own comments on that
 * field - Alt Mode sets it true, Bot Mode false).
 *
 * - The armor-ignore benefit is a Roll Options Dialog checkbox (dice.mjs), same shape as
 *   Penetrating Aim's own ignoreArmorPoints - see METALLIKATO_ID's own comment there.
 * - The reroll benefit is a plain, unconditional `system.reroll` compendium config (mode:"ones"),
 *   the same "Free-action cost unenforced, so unconditional" idiom Extremist (this same book)
 *   already establishes - zero code.
 * - "Shove or trip" is narrowed to Prone (trip) only - "shove" needs the still-unbuilt forced-
 *   movement/knockback mechanism (a confirmed project gap) - applied automatically on a
 *   qualifying melee Critical Success, the same "not something a player would opt out of, no
 *   checkbox needed" idiom Stunning Surprise/Barreling Beam's own identical Crit-triggered
 *   Condition already use.
 * - Multiple (2) Targets (↓1) is the one clause needing real state: `isMultipleTargetsWeapon`
 *   (helpers/multiple-targets.mjs) is checked SYNCHRONOUSLY, before the Roll Options Dialog even
 *   opens (it decides whether to do the independent-per-target-roll dispatch at all) - a
 *   post-dialog checkbox could never retroactively turn a single roll into that dispatch, the
 *   same "known too late" architecture gap already documented for the Ranger Prime reciprocal-
 *   Snag capstones. A persistent on/off toggle (this file, the same "Use"-button-flips-a-flag
 *   shape as Dig In) sidesteps that entirely - the flag is already set by the time
 *   isMultipleTargetsWeapon is checked. The paired ↓1 is applied wherever the toggle is active on
 *   a melee attack, in dice.mjs's own self-status section.
 */
const METALLIKATO_MULTIPLE_TARGETS_FLAG = 'metallikatoMultipleTargetsActive';

/**
 * Whether the actor currently has Metallikato's own Multiple Targets benefit toggled on.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isMetallikatoMultipleTargetsActive(actor) {
  return !!actor.getFlag?.('essence20', METALLIKATO_MULTIPLE_TARGETS_FLAG);
}

/**
 * Flips the toggle. Returns the new state (true = now active).
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function toggleMetallikatoMultipleTargets(actor) {
  const nowActive = !isMetallikatoMultipleTargetsActive(actor);
  await actor.setFlag('essence20', METALLIKATO_MULTIPLE_TARGETS_FLAG, nowActive);
  return nowActive;
}
