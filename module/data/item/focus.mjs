import { item } from './item';
import { itemDescription } from './item-description';

class FocusItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      essences: new fields.StringField({initial: ''}),
      essenceLevels: new fields.ArrayField(
        new fields.StringField(),
        {
          initial: [
            'level1',
            'level10',
          ],
        },
      ),
      roleId: new fields.StringField({initial: ''}),
      skills: new fields.ArrayField(new fields.StringField()),
    };
  }
}
