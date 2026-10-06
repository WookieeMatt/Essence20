import { registerTag } from "../../predicate.mjs";

/**
 * Round 15 (dice part): what a weapon effect's damage does to Health (Violent's "a weapon whose primary effect deals no
 * damage").
 *
 *   item:healthDamage          the rolled effect deals damage that costs Health: a damage value, of a type that isn't one
 *                              of NON_DAMAGE_EFFECT_TYPES (Stun builds its own pool; the rest apply Conditions)
 *   weapon:primariesNoDamage   the rolled effect's weapon has primary effects - its stored effects with no printed ↓ (the
 *                              measured reading of "primary": no primary/alternate flag exists) - and none of them deal
 *                              Health damage
 *
 * Measured across the compendium's weapons (2026-09-15, when this was dice.mjs code): the 18 weapons with such a shape
 * all have a no-↓ stun / maneuver / intimidate effect and ↓1 effects that deal real damage, which is why "primary" is
 * read as "no printed ↓".
 */

export const NON_DAMAGE_EFFECT_TYPES = [
  'stun', 'maneuver', 'intimidate', 'grapple', 'frightened', 'impaired', 'knocProne', 'cover',
  'blindingBlast', 'deafened',
];

const dealsHealthDamage = effect => !!effect?.damageValue && !NON_DAMAGE_EFFECT_TYPES.includes(effect.damageType);

registerTag('item:healthDamage', (rest, ctx) => (ctx.item ? dealsHealthDamage(ctx.item.system) : null));

registerTag('weapon:primariesNoDamage', (rest, ctx) => {
  const parentId = ctx.item?.flags?.essence20?.parentId;
  const weapon = parentId ? ctx.item.parent?.items?.get?.(parentId) ?? ctx.self?.items?.get?.(parentId) : null;
  if (!weapon) {
    return false;
  }

  const primaries = Object.values(weapon.system?.items ?? {}).filter(effect => effect?.type == 'weaponEffect' && !effect.shiftDown);
  return primaries.length > 0 && primaries.every(effect => !dealsHealthDamage(effect));
});
