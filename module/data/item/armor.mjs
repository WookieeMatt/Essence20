import { item } from './item';
import { itemDescription } from './item-description';
import { makeInt } from "../../generic-makers.mjs";
import { parentItem } from './parentItem';

const fields = foundry.data.fields;

class ArmorItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      availability: new fields.StringField({
        initial: 'standard',
        choices: Object.values(E20.availabilities),
      }),
      bonusEvasion: makeInt(0),
      bonusToughness: makeInt(0),
      classification: new fields.StringField({
        initial: 'light',
        choices: Object.values(E20.armorClassifications),
      }),
      equipped: new fields.BooleanField({initial: false}),
      traits: new fields.ArrayField(new fields.StringField()),
      upgradeTraits: new fields.ArrayField(new fields.StringField()),
    };
  }
}
