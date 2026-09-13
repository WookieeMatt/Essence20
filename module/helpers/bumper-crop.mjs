import { bankPendingBonus } from "./perks.mjs";
import { getNearbyEnemyTokens } from "./enemies.mjs";

/**
 * Bumper Crop (WTNV Citizen's Guide, Farmer Role, Tiller Focus, p.37, 4th level): "Make a DIF 10
 * Intimidation Skill Test as a Standard action. On a success, one enemy within Short range
 * suffers a Snag on their first Skill Test on their turn. You affect an additional enemy for
 * every 5 points that your result exceeds the DIF."
 *
 * A flat-DIF self roll (no target needed for the roll itself, unlike Absolute Menace/Elemental
 * Storm's own AoE-vs-Defense shape) - the number of enemies affected is only known AFTER the roll
 * resolves, based on the margin of success, so targets are picked post-hit rather than
 * auto-targeted beforehand. "Short range" is approximated as 30 feet (this project's own judgment
 * call - no numeric "Short range" constant exists anywhere in this codebase to confirm against,
 * and this book's own gear stat blocks don't print one either).
 */
const BUMPER_CROP_RANGE_FEET = 30;

export async function activateBumperCrop(actor) {
  await actor._dice.rollSkill({
    skill: 'intimidation', essence: 'strength', dif: '10', isBumperCrop: true,
  }, actor);
}

/**
 * Applies Bumper Crop's own Snag to as many nearby enemies as the roll's margin of success
 * allows - see this file's own doc comment above.
 * @param {Actor} actor   The actor who rolled Bumper Crop.
 * @param {Number} margin   How much the roll beat DIF 10 by (0 or more).
 */
export async function applyBumperCropSnag(actor, margin) {
  const numTargets = 1 + Math.floor(margin / 5);
  const nearbyEnemies = getNearbyEnemyTokens(actor, BUMPER_CROP_RANGE_FEET).slice(0, numTargets);
  for (const token of nearbyEnemies) {
    await bankPendingBonus(token.actor, 'pendingBumperCropSnag', { snag: true });
  }
}
