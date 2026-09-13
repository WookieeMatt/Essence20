/**
 * Void Warrior (Across the Stars, Grid Power, p.73): "You may spend 1 Personal Power to open
 * yourself up to the Void as a Free action, changing the damage inflicted by your unarmed and
 * weapon-based Attacks to Void damage for the remainder of the scene. While this Grid Power is
 * active, you cannot regain Personal Power."
 *
 * Same one-way flag-activation shape as Blazing Strikes - see that file's own doc comment for why
 * this isn't a Perk-style toggle. Unlike Blazing Strikes (unarmed only), this overrides EVERY
 * Attack's damage type, armed or not. The "cannot regain Personal Power while active" restriction
 * isn't enforced - Power regeneration happens at several independent call sites (Rest, the sidebar
 * regen button) with no shared choke point to gate, the same class of cross-cutting-hook gap
 * already flagged for Dino Charged.
 *
 * The compendium item's own powerCost was found set to null despite RAW's explicit "spend 1
 * Personal Power" - corrected to 1 directly in the source JSON alongside adding this mechanic.
 */
const VOID_WARRIOR_FLAG = 'voidWarriorActive';

export function isVoidWarriorActive(actor) {
  return !!actor.getFlag?.('essence20', VOID_WARRIOR_FLAG);
}

/**
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether this call actually changed anything.
 */
export async function activateVoidWarrior(actor) {
  if (isVoidWarriorActive(actor)) {
    return false;
  }

  await actor.setFlag('essence20', VOID_WARRIOR_FLAG, true);
  return true;
}
