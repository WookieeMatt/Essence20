import { canWriteStoryPoints, hasStoryPointsAvailable, requestStoryPointSpend } from "./story-points.mjs";

/**
 * Vibrating Palm (Factions in Action Vol. 2, Arashikage General Perk, p.31) - see this Perk's
 * own const comment in dice.mjs for the full RAW text and the Critical-Success Story Point grant
 * half. This file covers the other half: "at any time during the mission, you can spend a Story
 * Point to inflict massive damage on your target, instantly depleting their remaining Health and
 * rendering them Defeated" - auto-detects the currently-targeted actor (the same "no click to
 * place" idiom this project already uses everywhere a target is needed outside a roll), spends
 * the Story Point, and sets Health to 0 + Defeated. "Even a thousand miles away" is the same
 * unenforceable range-widening this project already accepts wherever RAW exceeds what Foundry's
 * own targeting UI can reach.
 */
export const VIBRATING_PALM_ID = "Compendium.essence20.intercontinental_adventures.Item.L98MDWiqeH8fp2Fz";

/**
 * @returns {Boolean}
 */
export function canUseVibratingPalm() {
  return hasStoryPointsAvailable(1);
}

/**
 * Spends 1 Story Point and instantly Defeats the currently-targeted actor.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether it actually fired.
 */
export async function activateVibratingPalm(actor) {
  if (!canUseVibratingPalm(actor)) {
    ui.notifications.warn(game.i18n.localize('E20.VibratingPalmNoStoryPoint'));
    return false;
  }

  const target = game.user.targets.first()?.actor;
  if (!target) {
    ui.notifications.warn(game.i18n.localize('E20.VibratingPalmNoTarget'));
    return false;
  }

  if (canWriteStoryPoints()) {
    requestStoryPointSpend(actor, 1);
  }

  await target.update({ 'system.health.value': 0 });
  await target.toggleStatusEffect('defeated', { active: true });
  return true;
}
