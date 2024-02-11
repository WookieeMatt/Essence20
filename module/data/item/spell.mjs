import { item } from './item';
import { E20 } from "../../../helpers/config.mjs";
import { makeInt } from "../generic-makers.mjs";

const fields = foundry.data.fields;

class SpellItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      circle: new fields.StringField({
        choices: Object.values(E20.spellCircles),
        initial: 'athletics',
      }),
      cost: makeInt(0),
      duration: new fields.StringField({initial: ''}),
      isSpecialized: new fields.BooleanField({initial: false}),
      range: makeInt(0),
      circle: new fields.StringField({
        choices: Object.values(E20.spellCircles),
        initial: 'athletics',
      }),
      tier: new fields.StringField({
        choices: Object.values(E20.spellTiers),
        initial: null,
      }),
    };
  }
}
