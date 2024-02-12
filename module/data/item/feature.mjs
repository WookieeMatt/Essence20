import { item } from './item';
import { itemDescription } from './item-description';

class FeatureItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
    };
  }
}
