import { item } from './item';
import { itemDescription } from './item-description';

import { makeInt, makeStr } from "../generic-makers.mjs";

class GearItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      quantity: makeInt(0),
      type: makeStr(''),
    };
  }
}
