import { item } from './item';
import { itemDescription } from './item-description';

class HangUpItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
    };
  }
}
