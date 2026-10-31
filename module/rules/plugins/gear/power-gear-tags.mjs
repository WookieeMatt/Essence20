import {
  bondOnCreate, bondOnEquip, crewSlotEquipped, rebondAllUpdates, slotClashes, slotEquipped,
} from "../../../items/gear/power-gear.mjs";
import { registerTag } from "../../predicate.mjs";

/**
 * Power gear (items/gear/power-gear.mjs): its rule tags, and the hooks that keep bonds and slots.
 *
 * Tags, for any rule's `when`:
 *   self:slotEquipped[:<slot>[:<name>]]       you have something on in that slot (any slot when none is named) that
 *                                             works for you - the item named, if one is
 *   self:crewSlotEquipped[:<slot>[:<name>]]   someone aboard this vehicle does - a Thunderhawk's power while its pilot
 *                                             wears Spectrum (mask:Spectrum)
 *
 * Hooks: an unbonded item bonds to whoever equips it first (or is given it already equipped); putting an item on takes
 * off its holder's other item in the same slot; a new actor (a copy, an import) holds its own items' bonds.
 */

/** What a slot tag's argument names: "the Spectrum mask", "something in the mask slot", "power gear". */
function wornPhrase(arg) {
  const [slot, ...name] = String(arg ?? '').split(':').map(part => part.trim());
  const item = name.join(':');
  if (item) {
    return [`the ${item} ${slot}`, `the ${item} ${slot}`];
  }

  return slot ? [`something in the ${slot} slot`, `anything in the ${slot} slot`] : ['power gear', 'power gear'];
}

registerTag('self:slotEquipped', (rest, ctx) => (ctx.self ? slotEquipped(ctx.self, rest) : null), {
  phrase: arg => {
    const [is, isnt] = wornPhrase(arg);
    return [`{who} {is} wearing ${is}`, `{who} {isnt} wearing ${isnt}`];
  },
});
registerTag('self:crewSlotEquipped', (rest, ctx) => (ctx.self ? crewSlotEquipped(ctx.self, rest) : null), {
  phrase: arg => {
    const [is, isnt] = wornPhrase(arg);
    return [`someone aboard is wearing ${is}`, `nobody aboard is wearing ${isnt}`];
  },
});

const mine = userId => userId == globalThis.game?.user?.id;

/** Takes off the holder's other items in this one's slot. */
async function clearSlot(item) {
  const clashes = slotClashes(item);
  if (clashes.length) {
    await item.parent.updateEmbeddedDocuments('Item', clashes.map(other => ({ _id: other.id, 'system.equipped': false })));
  }
}

if (typeof Hooks != 'undefined') {
  Hooks.on('preUpdateItem', (item, changes) => {
    bondOnEquip(item, changes);
  });
  Hooks.on('preCreateItem', item => {
    const bond = bondOnCreate(item);
    if (bond) {
      item.updateSource({ 'system.powerGear.bondedTo': bond });
    }
  });
  Hooks.on('updateItem', (item, changes, options, userId) => {
    if (mine(userId) && item.parent && foundry.utils.getProperty(changes, 'system.equipped') === true) {
      clearSlot(item);
    }
  });
  Hooks.on('createItem', (item, options, userId) => {
    if (mine(userId) && item.parent && item.system?.equipped !== false) {
      clearSlot(item);
    }
  });
  Hooks.on('createActor', async (actor, options, userId) => {
    const updates = mine(userId) ? rebondAllUpdates(actor) : [];
    if (updates.length) {
      await actor.updateEmbeddedDocuments('Item', updates);
    }
  });
}
