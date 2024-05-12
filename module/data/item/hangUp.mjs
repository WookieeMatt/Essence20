import { item } from './item.mjs';
import { itemDescription } from './item-description.mjs';

export class HangUpItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
    };
  }
}
