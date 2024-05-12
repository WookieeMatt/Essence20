import { item } from './item.mjs';
import { itemDescription } from './item-description.mjs';

export class BondItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
    };
  }
}
