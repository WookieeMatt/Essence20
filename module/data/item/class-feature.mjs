import { makeInt } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

const fields = foundry.data.fields;

export class ClassFeatureItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      uses: new fields.SchemaField({
        max: makeInt(0),
        value: makeInt(0),
      }),
    };
  }
}
