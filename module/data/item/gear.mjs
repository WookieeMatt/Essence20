import { item } from './item';
import { itemDescription } from './item-description';

const fields = foundry.data.fields;

class GearItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      quantity: makeInt(),
      type: new fields.StringField({initial: ''}),
    };
  }
}
