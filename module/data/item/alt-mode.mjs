import { E20 } from "../../helpers/config.mjs";

import { makeInt, makeStr, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

const fields = foundry.data.fields;

export class AltModeItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      altModeCrew: makeInt(0),
      altModeFirepoints: makeInt(0),
      altModeMovement: new fields.SchemaField({
        aerial: makeInt(0),
        aquatic: makeInt(0),
        ground: makeInt(0),
      }),
      altModesize: makeStrWithChoices(Object.keys(E20.actorSizes), 'common'),
      tokenImage: makeStr(null),
    };
  }
}
