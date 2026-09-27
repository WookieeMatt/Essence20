import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

const fields = foundry.data.fields;

export class GearItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      equipped: makeBool(true),
      gearType: makeStrWithChoices(Object.keys(E20.gearTypes), 'clothes'),
      quantity: makeInt(1),
      // Nanomite equipment (Quartermaster's Guide to Gear p.92) - one linked nanomite Power and its
      // uses, 1 for the usual single-use gear. See helpers/nanomite-gear.mjs.
      nanomite: new fields.SchemaField({
        powerUuid: new fields.StringField({ required: false, nullable: true, blank: true, initial: null }),
        uses: makeInt(1),
        spent: makeInt(0),
      }),
      blindsight: new fields.SchemaField({
        enabled: makeBool(false),
        range: makeInt(0),
      }),
      visionGrant: new fields.SchemaField({
        enabled: makeBool(false),
        mode: makeStrWithChoices(Object.keys(E20.visionModes), 'darkvision'),
        range: makeInt(0),
      }),
    };
  }
}
