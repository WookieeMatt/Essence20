/**
 * Brazen Strike (A Jump Through Time, Grid Power, p.57): "If you are under the effects of the
 * Frightened or Mesmerized conditions and successfully inflict damage upon an enemy with an
 * unarmed Attack, you remove the above conditions."
 *
 * A passive, always-on check (canActivate: false, no click) - unlike every dispatched Power this
 * project has built so far, this is checked automatically in dice.mjs's own post-hit processing,
 * the same "no click, just watch for the trigger" shape Terror's own accrual half already uses.
 * "Unarmed" is this project's own established "no parent weapon" proxy.
 */
const BRAZEN_STRIKE_CONDITIONS = ['frightened', 'mesmerized'];

/**
 * @param {Actor} actor   The actor who just landed the hit.
 */
export async function applyBrazenStrike(actor) {
  const toRemove = BRAZEN_STRIKE_CONDITIONS.filter(condition => actor.statuses?.has(condition));
  for (const condition of toRemove) {
    await actor.toggleStatusEffect(condition, { active: false });
  }
}
