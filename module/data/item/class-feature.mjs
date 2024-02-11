import { item } from './item';
import { itemDescription } from './item-description';

import { makeInt } from "../generic-makers.mjs";

const fields = foundry.data.fields;

class ClassFeatureItemData extends foundry.abstract.DataModel {
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
