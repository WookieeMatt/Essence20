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
      visionGrant: new fields.SchemaField({
        enabled: makeBool(false),
        mode: makeStrWithChoices(Object.keys(E20.visionModes), 'darkvision'),
        range: makeInt(0),
      }),
    };
  }
}
