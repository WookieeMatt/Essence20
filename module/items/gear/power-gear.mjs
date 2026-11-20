/**
 * Power gear (the item sheet's Power Gear section): gear, weapons, armor and upgrades that give powers - a M.A.S.K. mask,
 * the Sword of Omens, a Planeteer's ring. The item's rules already count only while it's equipped (rules/index.mjs#
 * isItemActive); these add, each optional (system.powerGear):
 *  - bonded:      it works only for the one it bonded to - whoever first equipped it (bondedTo, an actor id: every
 *                 token of that actor counts). A copy of the actor is the bond's new holder; the GM can Rebond.
 *  - slot:        a name ("mask", "helmet"); putting one on takes off whatever else its holder wears there.
 *  - altModeOnly: it works only while its holder (a Transformer, or a Vehicle or Zord with Alt Modes) is in an Alt Mode.
 *  - morphedOnly: it works only while its holder is Morphed (SilverHawks' armour, a Morphed form's own weapon).
 *
 * Import-free (rules/index.mjs reads it, and jest loads it without Foundry). Hooks and rule tags:
 * rules/plugins/gear/power-gear-tags.mjs.
 */

/** The item types with a Power Gear section. */
export const POWER_GEAR_TYPES = Object.freeze(['gear', 'weapon', 'armor', 'upgrade']);

const itemsOf = actor => actor?.items?.contents ?? (actor?.items ? [...actor.items] : []);
const settingsOf = item => (POWER_GEAR_TYPES.includes(item?.type) ? item.system?.powerGear ?? null : null);

/** An item's slot, lower-cased; '' when it has none. */
export const slotOf = item => String(settingsOf(item)?.slot ?? '').trim().toLowerCase();

/** Whether a bonded item works for this actor: not bonded, not bonded yet, or bonded to it. */
export function bondHolds(item, actor = item?.parent) {
  const gear = settingsOf(item);
  return !gear?.bonded || !gear.bondedTo || !actor?.id || gear.bondedTo == actor.id;
}

/** Whether an Alt Mode-only item works for this actor: it's in an Alt Mode. */
export function altModeHolds(item, actor = item?.parent) {
  return !settingsOf(item)?.altModeOnly || !!actor?.system?.isTransformed;
}

/** Whether a Morphed-only item works for this actor: it's Morphed. */
export function morphedHolds(item, actor = item?.parent) {
  return !settingsOf(item)?.morphedOnly || !!actor?.system?.isMorphed;
}

/** Whether the item's powers work for its holder (bond, Alt Mode, Morphed; equipped is rules/index.mjs's own). */
export const powerGearHolds = item => bondHolds(item) && altModeHolds(item) && morphedHolds(item);

/**
 * Whether an actor has something on in a slot that works for it: any slot when none is named, and any item unless one
 * is named too (`slot:name`, a tag's argument - "mask:Spectrum", a Planeteer's "ring:Fire").
 * @param {Actor} actor
 * @param {String} [slot]   The slot, optionally followed by `:<item name>`.
 * @returns {Boolean}
 */
export function slotEquipped(actor, slot = '') {
  const [wanted, ...rest] = String(slot ?? '').split(':').map(part => part.trim().toLowerCase());
  const name = rest.join(':');
  return itemsOf(actor).some(item => {
    const own = slotOf(item);
    return own && (!wanted || own == wanted) && (!name || String(item.name ?? '').trim().toLowerCase() == name)
      && item.system?.equipped !== false && bondHolds(item, actor) && altModeHolds(item, actor) && morphedHolds(item, actor);
  });
}

/**
 * Whether anyone aboard a vehicle (its crew and passengers - system.actors) has something on in a slot.
 * @param {Actor} vehicle
 * @param {String} [slot]   As slotEquipped's.
 * @param {Function} [resolve]   uuid -> actor.
 * @returns {Boolean}
 */
export function crewSlotEquipped(vehicle, slot = '', resolve = uuid => globalThis.fromUuidSync?.(uuid) ?? null) {
  return Object.values(vehicle?.system?.actors ?? {}).filter(entry => entry?.uuid).map(entry => resolve(entry.uuid))
    .some(crew => crew && crew != vehicle && slotEquipped(crew, slot));
}

/**
 * preUpdateItem: an unbonded item being equipped bonds to its holder, in the same update.
 * @param {Item} item
 * @param {Object} changes   Mutated.
 * @returns {Boolean}   Whether it bonded.
 */
export function bondOnEquip(item, changes) {
  const gear = settingsOf(item);
  const equipping = readPath(changes, 'system.equipped') === true;
  const bonding = readPath(changes, 'system.powerGear.bonded') === true;
  const bonded = bonding || gear?.bonded;
  const willBeEquipped = equipping || (bonding && item.system?.equipped !== false);
  if (!item?.parent?.id || !bonded || gear?.bondedTo || readPath(changes, 'system.powerGear.bondedTo') || !willBeEquipped) {
    return false;
  }

  changes.system ??= {};
  changes.system.powerGear = { ...(changes.system.powerGear ?? {}), bondedTo: item.parent.id };
  return true;
}

/** The bond for an item made on an actor already equipped (gear is, by default): its holder's id, or '' for none. */
export function bondOnCreate(item, actor = item?.parent) {
  const gear = settingsOf(item);
  return gear?.bonded && !gear.bondedTo && actor?.id && item.system?.equipped !== false ? actor.id : '';
}

/** The updates that make a new actor (a copy, an import) the holder of its own bonded items' bonds. */
export function rebondAllUpdates(actor) {
  return itemsOf(actor).filter(item => settingsOf(item)?.bonded && settingsOf(item).bondedTo && settingsOf(item).bondedTo != actor.id)
    .map(item => ({ _id: item.id, 'system.powerGear.bondedTo': actor.id }));
}

/** The holder's other equipped items in this item's slot (taken off when it goes on). */
export function slotClashes(item, actor = item?.parent) {
  const slot = slotOf(item);
  return slot ? itemsOf(actor).filter(other => other != item && other.id != item.id && slotOf(other) == slot && other.system?.equipped !== false) : [];
}

// A dotted path read off a plain update object (it may be nested or flat, as Foundry's updates are).
function readPath(object, path) {
  if (object && path in object) {
    return object[path];
  }

  return path.split('.').reduce((value, key) => (value && typeof value == 'object' ? value[key] : undefined), object);
}
