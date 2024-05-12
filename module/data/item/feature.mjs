import { item } from './item.mjs';
import { itemDescription } from './item-description.mjs';

export class FeatureItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
    };
  }
}
