/**
 * Better As One (Enigma of Combination, Component Ace, 10th level, p.34): "you may spend 1 Energon Point
 * from your personal Energon pool to give a combined form you are a component of the normal ↑1 bonus to
 * a Skill Test (instead of spending from the combined form's Energon pool, if any)."
 *
 * When a Combiner rolls, a component holding the Perk with Energon to spare is the donor: the Roll
 * Options Dialog offers the Energon ↑1 even if the combined form has none, and the point comes out of
 * the donor's own pool. (The Perk's Specialization half is in documents/actor.mjs.)
 */

export const BETTER_AS_ONE_ID = "Compendium.essence20.enigma_of_combination.Item.XnmVJF4XNcsaXAKL";

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource;
}

function has(actor, id) {
  const items = actor?.items;
  const list = Array.isArray(items?.contents) ? items.contents : (items && typeof items[Symbol.iterator] == 'function' ? [...items] : []);
  return list.some(item => sourceOf(item) == id);
}

/**
 * The component that pays, if this is a combined form with one.
 * @param {Actor} actor   The rolling Megaform.
 * @returns {Actor|null}
 */
export function betterAsOneDonor(actor) {
  if (actor?.type != 'megaform') {
    return null;
  }

  for (const entry of Object.values(actor.system?.actors ?? {})) {
    let component = null;
    try {
      component = globalThis.fromUuidSync?.(entry?.uuid);
    } catch (error) {
      component = null;
    }

    if (component && has(component, BETTER_AS_ONE_ID) && (Number(component.system?.energon?.normal?.value) || 0) > 0) {
      return component;
    }
  }

  return null;
}

/** Take the point from the donor - through the GM when the roller doesn't own them. */
export async function payBetterAsOne(donor) {
  const value = Math.max(0, (Number(donor.system?.energon?.normal?.value) || 0) - 1);
  await donor.update({ 'system.energon.normal.value': value });
}
