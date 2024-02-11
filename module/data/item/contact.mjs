import { item } from './item';
import { itemDescription } from './item-description';
import { makeInt } from "../generic-makers.mjs";

const fields = foundry.data.fields;

class ContactItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      gainingTheContact: new fields.StringField({initial: ''}),
      allegiancePoints: makeInt(0),
      perks: new fields.StringField({initial: ''}),
    };
  }
}
