import { item } from './item.mjs';
import { itemDescription } from './item-description.mjs';

import { makeInt, makeStr } from "../generic-makers.mjs";

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
