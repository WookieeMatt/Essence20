import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

export class MegaformTraitItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
    };
  }
}
