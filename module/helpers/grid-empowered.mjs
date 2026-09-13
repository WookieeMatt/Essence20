import { applyDamage } from "./combat.mjs";

/**
 * Grid Empowered (Through the Shattered Grid, Grid Power, p.74): "The Shattering of the Morphin
 * Grid has imbued you with astounding power that you can channel without the effort of Morphing.
 * You may spend 1 Power to deal 1 Electric damage to one target."
 *
 * RAW names no Skill Test at all (unlike almost every other offensive Power/Perk in this project,
 * which triggers a real Attack or Skill Test roll) - read literally as an automatic, unrollable
 * effect: spend the cost, damage whoever is targeted directly via the same applyDamage() pipeline
 * the "Apply Damage" chat button already uses, no roll, no Defense compared against.
 */
const DAMAGE_VALUE = 1;
const DAMAGE_TYPE = 'electric';

/**
 * Deals Grid Empowered's own fixed 1 Electric damage directly to whichever token is currently
 * targeted. The 1-Power spend itself is handled generically by the sheet's own Power-activation
 * flow (power-handler.mjs#powerCost) before this runs, same as every other power-type dispatch.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   False (nothing applied) if there's no valid target.
 */
export async function activateGridEmpowered(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    return false;
  }

  await applyDamage(targetActor, DAMAGE_VALUE, DAMAGE_TYPE);
  return true;
}
