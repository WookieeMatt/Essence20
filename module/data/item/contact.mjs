import { makeInt, makeStr } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

export class ContactItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      gainingTheContact: makeStr(''),
      allegiancePoints: makeInt(0),
      perks: makeStr(''),
    };
  }
}
