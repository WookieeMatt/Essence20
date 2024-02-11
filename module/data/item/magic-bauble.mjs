import { item } from './item';
import { itemDescription } from './item-description';
import { makeStrWithChoices } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

class MagicBaubleItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      duration: new fields.StringField({initial: ''}),
      range: new fields.StringField({initial: ''}),
      spellcastingShift: makeStrWithChoices('d2', E20.skillRollableShifts),
    };
  }
}
