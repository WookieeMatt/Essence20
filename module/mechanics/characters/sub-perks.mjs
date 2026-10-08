/**
 * Perks picked from another Perk's own list - Grid Tech I's Gridspeak Receivers and Transmitters - on the actor sheet
 * (user request 2026-10-07). The pick links the child to its parent (flags.essence20.parentId, set by
 * sheet-handlers/perk-handler.mjs#onPerkDrop), but a Perk's own item list records no level, so the child showed no level
 * badge and sorted to the bottom. Here a child takes its parent's level and lists right under it.
 * Plain Node safe.
 */

const parentOf = (item, items) => {
  const id = item?.flags?.essence20?.parentId ?? item?.getFlag?.('essence20', 'parentId');
  const parent = id ? items.get?.(id) ?? [...items].find(other => other.id == id) : null;
  return parent?.type == 'perk' && item.type == 'perk' ? parent : null;
};

/**
 * Marks every sub-Perk (system.subPerkOf, derived for the sheet only) and gives it its parent's level when it has none
 * of its own. A chain (a sub-Perk's own sub-Perk) follows up to the first level found.
 * @param {Iterable<Item>} items   The actor's items, after grantedLevel has been set on them.
 */
export function nestSubPerks(items) {
  const list = items ?? [];
  for (const item of list) {
    const parent = parentOf(item, list);
    if (!parent) {
      continue;
    }

    item.system.subPerkOf = parent.id;
    let source = parent;
    for (let depth = 0; source && item.system.grantedLevel == null && depth < 5; depth++) {
      item.system.grantedLevel = source.system?.grantedLevel ?? null;
      source = parentOf(source, list);
    }
  }
}

/**
 * The list with each sub-Perk moved to just after its parent (after any earlier siblings), when the parent is in the
 * same list. Order is otherwise kept.
 * @param {Array<Item>} perks
 * @returns {Array<Item>}
 */
export function withSubPerksUnderParents(perks) {
  const ids = new Set(perks.map(perk => perk.id));
  const children = new Map();
  for (const perk of perks) {
    const parentId = perk.system?.subPerkOf;
    if (parentId && ids.has(parentId)) {
      children.set(parentId, [...(children.get(parentId) ?? []), perk]);
    }
  }

  const out = [];
  const place = perk => {
    out.push(perk);
    for (const child of children.get(perk.id) ?? []) {
      place(child);
    }
  };

  for (const perk of perks) {
    const parentId = perk.system?.subPerkOf;
    if (!(parentId && ids.has(parentId))) {
      place(perk);
    }
  }

  return out;
}
