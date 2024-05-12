import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

export class TraitItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
    };
  }
}