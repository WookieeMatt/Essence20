import { registerRef } from "../../formula.mjs";

/**
 * Ref `@rangedWeapons` (round 15, systems - docs/rules-batches/slSystems15.md): how many separate ranged weapons the
 * actor attacks with - each non-melee attack's weapon, or the attack itself when it has none (a Zord's built-in
 * attacks), counted once. Barrage Attack's "every other ranged weapon it has" is `@rangedWeapons - 1`.
 */
export function rangedWeaponCount(actor) {
  const keys = new Set();
  const items = actor?.items?.contents ?? (actor?.items ? [...actor.items] : []);
  for (const item of items) {
    if (item.type == 'weaponEffect' && item.system?.classification?.style != 'melee') {
      keys.add(item.flags?.essence20?.parentId ?? item.id ?? item.name);
    }
  }

  return keys.size;
}

registerRef('rangedWeapons', (key, scope) => rangedWeaponCount(scope.actor));
