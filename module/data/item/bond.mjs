import { item } from './item';
import { itemDescription } from './item-description';

class BondItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
    };
  }
}
