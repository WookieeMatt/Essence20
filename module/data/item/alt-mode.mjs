import { E20 } from "../../../helpers/config.mjs";
import { item } from './item.mjs';
import { itemDescription } from './item-description.mjs';

import { makeInt, makeStrWithChoices } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

export class AltModeItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      crew: makeInt(0),
      firepoints: makeInt(0),
      movement: fields.SchemaField({
        aerial: makeInt(0),
        aquatic: makeInt(0),
        ground: makeInt(0),
      }),
      size: makeStrWithChoices('common', E20.actorSizes),
    };
  }
}
