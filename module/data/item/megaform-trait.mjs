import { item } from './item';
import { itemDescription } from './item-description';

class MegaformTraitItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
    };
  }
}
