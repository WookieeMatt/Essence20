import { makeBool, makeStr } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

/**
 * Power gear (items/gear/power-gear.mjs): optional bonds, a slot and Alt Mode- or Morphed-only use, on gear, weapons, armor and
 * upgrades - the item sheet's Power Gear section. All off by default.
 */
export const powerGear = () => ({
  powerGear: new fields.SchemaField({
    // Works only for the actor it bonded to (bondedTo: an actor id, set when first equipped).
    bonded: makeBool(false),
    bondedTo: makeStr(''),
    // Only one equipped item per slot name ("mask", "helmet").
    slot: makeStr(''),
    // Works only while its holder is in an Alt Mode.
    altModeOnly: makeBool(false),
    // Works only while its holder is Morphed.
    morphedOnly: makeBool(false),
  }),
});
