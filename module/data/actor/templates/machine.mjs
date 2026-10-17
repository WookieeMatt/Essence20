import { makeBool, makeInt, makeStr } from "../../generic-makers.mjs";

import { makeDefensesFields as makeCharacterDefensesFields } from "./character.mjs";

const fields = foundry.data.fields;

/**
 * Vehicle/Zord Defenses use the same computed base/armor/bonus/essence/morphed/shield/total
 * shape as a Player Character's (see Essence20Actor#_prepareDefenses) plus one extra field:
 * `usesDrivers`, true only for Willpower/Cleverness. Per RAW (GI Joe CRB p.173, PR CRB p.126 -
 * the "Vehicle" trait; PR CRB p.136's baseline Zord stat block footnote "*Use the pilot's
 * Defense"), a Vehicle/Zord has no Willpower/Cleverness of its own by default - effects
 * targeting those Defenses instead target its current driver/pilot. See
 * mechanics/combat/combat.mjs#getDefenseValue for where that substitution is actually applied.
 */
export function makeDefensesFields(name, essence, usesDrivers, base, armor = 0) {
  return new fields.SchemaField({
    ...makeCharacterDefensesFields(name, essence),
    armor: makeInt(armor),
    base: makeInt(base),
    usesDrivers: makeBool(usesDrivers),
  });
}

// `base` is what the sheet edits; `value` is worked out from it each prep, with the Features' Active Effects and item
// rules on top (mechanics/vehicles/machine-essences.mjs). A Megaform's value comes from its Zords instead.
export function makeEssencesFields(usesDrivers, init) {
  return new fields.SchemaField({
    base: makeInt(init),
    // Essence damage taken (mechanics/combat/essence-current.mjs): off the score for the current amount, healed by a
    // Rest, never moving the base.
    damage: makeInt(0),
    usesDrivers: makeBool(usesDrivers),
    value: makeInt(init),
  });
}

export const machine = () => ({
  canHover: makeBool(false),
  crew: new fields.SchemaField({
    description: makeStr(''),
    numDrivers: makeInt(1),
    numPassengers: makeInt(0),
  }),
  defenses: new fields.SchemaField({
    toughness: makeDefensesFields('toughness', 'strength', false, 10),
    evasion: makeDefensesFields('evasion', 'speed', false, 10),
    willpower: makeDefensesFields('willpower', 'smarts', true, null),
    cleverness: makeDefensesFields('cleverness', 'social', true, null),
  }),
  essences: new fields.SchemaField({
    strength: makeEssencesFields(false, 3),
    speed: makeEssencesFields(false, 3),
    smarts: makeEssencesFields(true, null),
    social: makeEssencesFields(true, null),
  }),
});
