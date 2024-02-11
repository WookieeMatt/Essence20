import { item } from './item';
import { itemDescription } from './item-description';
import { makeInt } from "../generic-makers.mjs";

const fields = foundry.data.fields;

class GearItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      quantity: makeInt(0),
      type: new fields.StringField({initial: ''}),
    };
  }
}
