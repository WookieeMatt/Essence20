import { item } from './item';
import { itemDescription } from './item-description';

class MagicBaubleItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      duration: new fields.StringField({initial: ''}),
      range: new fields.StringField({initial: ''}),
      spellcastingShift: new fields.StringField({
        choices: Object.values(E20.skillRollableShifts),
        initial: 'd2',
      }),
    };
  }
}
