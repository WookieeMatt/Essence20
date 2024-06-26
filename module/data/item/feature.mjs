import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

export class FeatureItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
    };
  }
}
