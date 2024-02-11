import { item } from './item';
import { itemDescription } from './item-description';

const fields = foundry.data.fields;

class ClassFeatureItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      uses: new fields.SchemaField({
        max: makeInt(),
        value: makeInt(),
      }),
    };
  }
}
