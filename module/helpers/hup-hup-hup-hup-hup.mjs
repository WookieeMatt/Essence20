import { getNearbyAllyTokens } from "./allies.mjs";

/**
 * Hup! Hup! Hup! Hup! Hup! (Sgt Slaughter Sourcebook, Drill Instructor Focus, Officer, 6th level,
 * p.10): "As a Standard action, roll an Intimidation Skill Test. Until the end of your next turn,
 * your allies add an amount to their Ground Movement equal to your result rounded down to the
 * nearest 5."
 *
 * Dispatched as a "Use" button on the Officer's own item, triggering a real Intimidation Skill
 * Test via actor._dice.rollSkill() (the same "trigger a real dialog roll" shape this project
 * already establishes) against a trivial DIF 0 - the roll's own success/failure has no bearing on
 * this Perk at all (RAW names no failure case), only the raw total matters, so DIF 0 guarantees
 * the post-hit processing always fires without needing a "comparisonless roll" concept this
 * codebase doesn't have. The rounded-down total is broadcast to every nearby ally (no RAW-stated
 * range - the same "unscoped when RAW doesn't name a distance" idiom On Your Feet's own party-wide
 * grant already establishes this same session), each banked as their OWN flag (read in
 * documents/actor.mjs#_prepareMovement, the same "checked directly on THIS actor, not gated on
 * actorHasPerk" shape Engine Override's identical +15ft Ground Movement grant already uses - the
 * flag lives on the boosted ally, not the Officer who granted it).
 *
 * "Until the end of your next turn" reuses Jury Rig's own "through the round after the one it was
 * granted in" (expiresRound: round + 1) approximation - a plain single-round window would
 * under-deliver relative to RAW's own two-turn span, same reasoning Jury Rig's own doc comment
 * already gives for its identical duration.
 */
const FLAG_KEY = 'pendingHupHupHupHupHupBonus';

/**
 * Rolls the Officer's own Intimidation Skill Test - the actual broadcast happens in dice.mjs's
 * own post-hit processing once the total is known.
 * @param {Actor} officer
 * @returns {Promise<void>}
 */
export async function activateHupHupHupHupHup(officer) {
  await officer._dice.rollSkill({
    skill: 'intimidation', essence: 'strength', shiftUp: 0, shiftDown: 0, dif: '0',
    isHupHupHupHupHupAttempt: true,
  }, officer);
}

/**
 * Banks the rounded-down bonus on every nearby ally (excluding the Officer themselves - RAW says
 * "your allies," not "you").
 * @param {Actor} officer
 * @param {Number} total   The roll's own raw total.
 * @returns {Promise<void>}
 */
export async function broadcastHupHupHupHupHupBonus(officer, total) {
  const bonus = Math.floor(total / 5) * 5;
  if (bonus <= 0) {
    return;
  }

  const expiresRound = (game.combat?.round ?? 0) + 1;
  for (const token of getNearbyAllyTokens(officer, Infinity)) {
    await token.actor.setFlag('essence20', FLAG_KEY, { bonus, expiresRound });
  }
}

/**
 * The actor's own currently-active Hup! Hup! Hup! Hup! Hup! Ground Movement bonus, 0 if none or
 * expired.
 * @param {Actor} actor
 * @returns {Number}
 */
export function getHupHupHupHupHupBonus(actor) {
  const flag = actor.getFlag?.('essence20', FLAG_KEY);
  if (!flag) {
    return 0;
  }

  const stillActive = game.combat ? game.combat.round <= flag.expiresRound : true;
  return stillActive ? flag.bonus : 0;
}
