import { item } from './item';
import { itemDescription } from './item-description';
import { parentItem } from './parentItem';

class InfluenceItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      type: new fields.StringField({initial: ''}),
      mandatoryHangUp: new fields.BooleanField({initial: false}),
      skills: new fields.ArrayField(new fields.StringField()),
    };
  }
}
