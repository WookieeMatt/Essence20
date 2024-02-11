import { item } from './item';
import { itemDescription } from './item-description';

const fields = foundry.data.fields;

class ContactItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      gainingTheContact: new fields.StringField({initial: ''}),
      allegiancePoints: makeInt(),
      perks: new fields.StringField({initial: ''}),
    };
  }
}
