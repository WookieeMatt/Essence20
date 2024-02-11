import { item } from './item';

const fields = foundry.data.fields;

class TraitItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
    };
  }
}
