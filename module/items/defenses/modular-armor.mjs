/**
 * Modular (Across the Stars, Armor Traits, p.85): Medium-or-smaller weapons attached to the armor,
 * up to the trait's number, count as Integrated while it is worn.
 *
 * The printed "(X)" lives in the armor's own system.modularAllowance (data/item/armor.mjs), the
 * same "magnitude field next to a plain trait membership check" shape Bulwark's
 * bulwarkHealthBonus already uses. Which of the wearer's weapons are socketed is a list of
 * embedded weapon ids on the ARMOR (system.modularWeaponIds), picked on the armor's own sheet
 * (templates/item/details/armor.hbs) - storing it on the armor keeps the allowance check in one
 * place and lets a plain form submit edit it.
 *
 * That Integrated is the weapon SIZE (GI Joe CRB: can't be disarmed, needn't be drawn, takes 0
 * hands), so a
 * socketed weapon reports effectiveSize 'integrated' and derivedHands 0 - the two derived fields
 * the Gear tab and the Load Out hand tally (documents/actor.mjs#_prepareLoadout) already read.
 * Applied from the ACTOR's own prepareDerivedData, not the weapon's, because it depends on a
 * different Item (the armor) whose own preparation order relative to the weapon isn't fixed.
 * Only while the armor is equipped ("while in the armor"); entries past the allowance, or for a
 * weapon larger than Medium, are ignored rather than rejected so a stale id can't break prep.
 */

// Medium or smaller, in E20.weaponSizes' own ascending order.
export const MODULAR_WEAPON_SIZES = ['integrated', 'sidearm', 'light', 'medium'];

/**
 * @param {Item} item
 * @returns {Boolean}   Whether this is armor carrying the Modular trait (its own or an upgrade's).
 */
export function isModularArmor(item) {
  if (item?.type != 'armor') {
    return false;
  }

  const traits = item.system?.itemAndUpgradeTraits
    ?? [...(item.system?.traits ?? []), ...(item.system?.upgradeTraits ?? [])];
  return traits.includes('modular');
}

/**
 * @param {Item} weapon
 * @returns {Boolean}   Whether the weapon is small enough (Medium or smaller) to attach.
 */
export function isModularQualifyingWeapon(weapon) {
  return weapon?.type == 'weapon' && MODULAR_WEAPON_SIZES.includes(weapon.system?.classification?.size);
}

/**
 * The weapons actually socketed into this armor: its stored ids, resolved against the wearer's
 * own Items, qualifying sizes only, capped at the printed allowance (first-listed wins).
 * @param {Actor} actor
 * @param {Item} armor
 * @returns {Array<Item>}
 */
export function getModularAttachments(actor, armor) {
  const allowance = Math.max(0, armor?.system?.modularAllowance ?? 0);
  const ids = armor?.system?.modularWeaponIds ?? [];
  const attached = [];
  for (const id of ids) {
    if (attached.length >= allowance) {
      break;
    }

    const weapon = actor?.items?.get?.(id);
    if (isModularQualifyingWeapon(weapon) && !attached.includes(weapon)) {
      attached.push(weapon);
    }
  }

  return attached;
}

/**
 * Called from Essence20Actor#prepareDerivedData, before the Load Out tally. Marks every weapon
 * socketed into an EQUIPPED Modular armor as Integrated, and records each Modular armor's own
 * used count for its sheet.
 * @param {Actor} actor
 */
export function applyModularIntegration(actor) {
  // Iterable guard: some callers (and test doubles) hand over an items stand-in that's a plain
  // lookup object rather than a Collection.
  const items = actor?.items;
  if (!items || typeof items[Symbol.iterator] != 'function') {
    return;
  }

  for (const armor of items) {
    if (!isModularArmor(armor)) {
      continue;
    }

    const attached = getModularAttachments(actor, armor);
    armor.system.modularUsed = attached.length;
    if (!armor.system.equipped) {
      continue;
    }

    for (const weapon of attached) {
      weapon.system.modularIntegrated = true;
      weapon.system.effectiveSize = 'integrated';
      weapon.system.derivedHands = 0;
    }
  }
}

/**
 * Armor sheet choices: every qualifying weapon the wearer owns, with whether it's attached and
 * whether it can still be ticked (unticked ones lock once the allowance is full).
 * @param {Actor} actor
 * @param {Item} armor
 * @returns {Array<{id: String, name: String, attached: Boolean, disabled: Boolean}>}
 */
export function getModularCandidates(actor, armor) {
  if (!actor || !isModularArmor(armor)) {
    return [];
  }

  const attachedIds = getModularAttachments(actor, armor).map(weapon => weapon.id);
  const full = attachedIds.length >= (armor.system?.modularAllowance ?? 0);
  const candidates = [];
  for (const weapon of actor.items) {
    if (!isModularQualifyingWeapon(weapon)) {
      continue;
    }

    const attached = attachedIds.includes(weapon.id);
    candidates.push({ id: weapon.id, name: weapon.name, attached, disabled: !attached && full });
  }

  return candidates;
}

/**
 * The armor sheet renders one checkbox per candidate, all named system.modularWeaponIds with the
 * weapon id as value. FormDataExtended turns that into an array holding the id or null per box
 * (or a bare scalar when there's only one box) - this folds it back into a clean id list.
 * @param {*} raw
 * @returns {Array<String>|undefined}   undefined when the form didn't carry the field at all.
 */
export function normalizeModularWeaponIds(raw) {
  if (raw === undefined) {
    return undefined;
  }

  return [raw].flat().filter(id => typeof id == 'string' && id);
}
