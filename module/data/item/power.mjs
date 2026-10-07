import { E20 } from "../../util/config.mjs";

import { makeBool, makeInt, makeStr, makeStrWithChoices } from "../generic-makers.mjs";

import { aoeSchema } from "../aoe-schema.mjs";
import { attackSchema } from "../attack-schema.mjs";
import { durationSchema, formatDuration } from "../duration-schema.mjs";
import { rerollSchema } from '../reroll-schema.mjs';
import { activation } from './templates/activation.mjs';
import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

export class PowerItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      // 'free' rather than the shared 'none' default - `power` has declared its own actionType
      // since long before the action economy existed, and 4 of the 107 compendium Powers authored
      // their type by omitting the field. Keeping the old default stops those being silently
      // reclassified. See data/item/templates/activation.mjs.
      ...activation('free'),
      // Area of Effect shape + radius - see module/data/aoe-schema.mjs.
      ...aoeSchema(),
      // Attack fields, for the Sorcerous attack Powers - see module/data/attack-schema.mjs.
      ...attackSchema(),
      // Which Skill the attack above is rolled with. A spell never needs this (always
      // Spellcasting), but a Power does: Finster's Monster-Magic Cookbook prints both
      // "Targeting (Sorcery) attack" and "Culture (Arcane) attack". Null for a non-attack Power.
      attackSkill: makeStrWithChoices(Object.keys(E20.skills), null),
      // Availability (Standard, Limited, Restricted...) - printed for every nanomite power, and what the
      // Basal/Intricate Nano Infusion Perks choose by.
      availability: makeStrWithChoices(Object.keys(E20.availabilities), null),
      canActivate: makeBool(false),
      // How long an activated Power lasts - see module/data/duration-schema.mjs. Powers had no
      // duration field at all before; an area Power needs one for the same reason a spell does.
      ...durationSchema(),
      hasVariableCost: makeBool(false),
      maxPowerCost: makeInt(null),
      powerCost: makeInt(null),
      // Deprecated 2026-10-07: shown from system.prerequisites now; remove from the data model in 6.1.
      // (The prerequisite tags are system.prerequisites - templates/item-description.mjs, rules/prerequisites.mjs.)
      prerequisite: makeStr(null),
      // Deprecated 2026-10-07: unused since rules (Temporal Awareness, Lucky Charm and Future Vision carry Reroll
      // rules); remove from the data model in 6.1.
      ...rerollSchema(),
      selectionLimit: makeInt(1),
      type: makeStrWithChoices(Object.keys(E20.powerTypes), 'grid'),
      usesInterval: makeStrWithChoices(Object.keys(E20.usesInterval), 'perScene'),
      usesPer: makeInt(null),
      // Uses spent since the last Rest, for a power with a per-day limit - see mechanics/resources/nanomite-uses.mjs.
      usesSpent: makeInt(0),
    };
  }

  prepareDerivedData() {
    // See SpellItemData's own note - the readable duration is built once here rather than in
    // each template that shows it.
    this.durationLabel = formatDuration(this.duration);

    return super.prepareDerivedData();
  }
}
