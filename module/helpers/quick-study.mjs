import { getDefenseValue } from "./combat.mjs";

/**
 * Quick Study (WTNV Citizen's Guide, General Perk, p.50): "You can size up a foe just by looking
 * at them. Once per scene, you can spend a Free action to learn the Toughness, Evasion,
 * Willpower, and Cleverness Defenses of a target that you can see."
 *
 * A pure information reveal (no dice, no status effect) - posts the four Defense values to chat
 * against whichever token is currently targeted, the same auto-detect "Use" button shape as Mark
 * Target/Fight Me!. Once per scene, dispatched directly in banked-buffs.mjs.
 */

/**
 * Builds the chat message content revealing the currently-targeted actor's own four Defenses -
 * see this file's own doc comment above.
 * @param {Actor} _actor   Unused - kept only for a consistent onPerkUse dispatch signature.
 * @returns {String|null}   The chat content, or null (and a warning) if nothing is targeted.
 */
export function revealTargetDefenses(_actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.QuickStudyNoTarget'));
    return null;
  }

  return game.i18n.format('E20.QuickStudyResult', {
    target: targetActor.name,
    toughness: getDefenseValue(targetActor, 'toughness'),
    evasion: getDefenseValue(targetActor, 'evasion'),
    willpower: getDefenseValue(targetActor, 'willpower'),
    cleverness: getDefenseValue(targetActor, 'cleverness'),
  });
}
