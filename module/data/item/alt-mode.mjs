import { E20 } from "../../helpers/config.mjs";

import { makeInt, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

const fields = foundry.data.fields;

export class AltModeItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      crew: makeInt(0),
      firepoints: makeInt(0),
      movement: new fields.SchemaField({
        aerial: makeInt(0),
        aquatic: makeInt(0),
        ground: makeInt(0),
      }),
      size: makeStrWithChoices('common', Object.keys(E20.actorSizes)),
    };
  }
}
