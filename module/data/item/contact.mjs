import { item } from './item';
import { itemDescription } from './item-description';

import { makeInt, makeStr } from "../generic-makers.mjs";

class ContactItemData extends foundry.abstract.DataModel {
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
