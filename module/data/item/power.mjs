import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStrWithChoices } from "../generic-makers.mjs";

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
      canActivate: makeBool(false),
      // How long an activated Power lasts - see module/data/duration-schema.mjs. Powers had no
      // duration field at all before; an area Power needs one for the same reason a spell does.
      ...durationSchema(),
      hasVariableCost: makeBool(false),
      maxPowerCost: makeInt(null),
      powerCost: makeInt(null),
      // Temporal Awareness (Across the Stars, Grid Power, p.73) is the first Power to need this -
      // see helpers/reroll.mjs's own actor.items scan, which has no item.type filter at all and
      // already picks up any item exposing this schema generically, the same way it already does
      // for Perks.
      ...rerollSchema(),
      selectionLimit: makeInt(1),
      type: makeStrWithChoices(Object.keys(E20.powerTypes), 'grid'),
      usesInterval: makeStrWithChoices(Object.keys(E20.usesInterval), 'perScene'),
      usesPer: makeInt(null),
    };
  }

  prepareDerivedData() {
    // See SpellItemData's own note - the readable duration is built once here rather than in
    // each template that shows it.
    this.durationLabel = formatDuration(this.duration);

    return super.prepareDerivedData();
  }
}
