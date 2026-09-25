/**
 * Wrestler (PR CRB, General Perk, p.99): "You can use a Free action to try to pin a creature
 * grappled by you. To do so, make a DIF 12 Might Skill Test (modified by the target's Size Class).
 * If you succeed, the grappled creature is made Prone in an adjacent square." (The Perk's other
 * clause, an Edge on attacks to Grapple, is a plain damageType check in dice.mjs - see WRESTLER_ID's
 * own comment there.)
 *
 * The DIF 12 Might Skill Test (and its Size Class modifier) isn't gated here - this system's own
 * generic Skill Test tools already let a player roll Might against a DIF the GM sets, the same
 * "the player rolls it themselves, then clicks Use once they know they succeeded" idiom
 * helpers/eye-for-appraisal.mjs's own doc comment already establishes for this exact shape of
 * ability. This file is only the "on success" half: a Use button (canUseWrestlerPin/
 * activateWrestlerPin, wired into helpers/banked-buffs.mjs) that Prones whichever token is
 * currently targeted. "An adjacent square" is positional/narrative and not separately tracked,
 * the same drop every other placement-only clause in this project already accepts.
 */

/**
 * Whether the currently-targeted token is a valid pin target - "a creature grappled by you", read
 * as the target currently carrying the Grappled Condition (this system has no per-attacker
 * grappler tracking, so "by you" can't be verified any more precisely than that).
 * @param {Actor} _actor   Unused - kept only for a consistent canUsePerk dispatch signature.
 * @returns {Boolean}
 */
export function canUseWrestlerPin(_actor) {
  return !!game.user?.targets?.first()?.actor?.statuses?.has('grappled');
}

/**
 * Pins the currently-targeted Grappled creature, making it Prone.
 * @param {Actor} _actor   Unused - kept only for a consistent onPerkUse dispatch signature.
 * @returns {Promise<Actor|null>}   The creature Proned, or null if nothing valid was targeted.
 */
export async function activateWrestlerPin(_actor) {
  const target = game.user?.targets?.first()?.actor;
  if (!target?.statuses?.has('grappled')) {
    ui.notifications.warn(game.i18n.localize('E20.WrestlerPinNoTarget'));
    return null;
  }

  await target.toggleStatusEffect('prone', { active: true });
  return target;
}
