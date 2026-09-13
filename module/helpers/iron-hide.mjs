/**
 * Iron Hide (GI Joe CRB, Vanguard base, 1st level, p.107): "If an attack would make you Defeated,
 * you may spend a Story Point to attempt a Brawn DIF 15 Skill Test to ignore the damage." The
 * Skill Test's own outcome isn't known synchronously, so this doesn't intercept the damage before
 * it lands (unlike a plain confirm-and-reduce check) - the GM's Apply Damage confirm (see
 * chat.mjs#onApplyDamage) spends the Story Point and triggers this real interactive roll, and the
 * damage is restored (Health healed back up) afterward on a success, via isIronHideAttempt's own
 * post-hit consumption in dice.mjs - the same "trigger a real dialog roll via
 * actor._dice.rollSkill(), read the outcome back in post-hit processing" shape Rousing Comeback's
 * own flat-DIF Brawn Skill Test already establishes.
 */
export const IRON_HIDE_ID = "Compendium.essence20.gi_joe_crb.Item.hXtchClOmMDDeWB9";

/**
 * @param {Actor} actor   The Vanguard who was just about to be Defeated.
 * @param {Number} damageAmount   The damage that was just applied - restored to Health on success.
 */
export async function activateIronHide(actor, damageAmount) {
  await actor._dice.rollSkill({
    skill: 'brawn', essence: 'strength', dif: '15', isIronHideAttempt: true, ironHideDamage: damageAmount,
  }, actor);
}
