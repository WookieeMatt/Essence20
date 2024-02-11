import { item } from './item';
import { itemDescription } from './item-description';
import { parentItem } from './parentItem';

class OriginItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      baseAerialMovement: makeInt(),
      baseAquaticMovement: makeInt(),
      baseGroundMovement: makeInt(),
      essences: new fields.ArrayField(new fields.StringField()),
      languages: new fields.StringField({initial: ''}),
      skills: new fields.ArrayField(new fields.StringField()),
      startingHealth: makeInt(),
    };
  }
}
