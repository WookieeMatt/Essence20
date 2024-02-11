import { item } from './item';
import { E20 } from "../../../helpers/config.mjs";
import { makeInt } from "../generic-makers.mjs";

const fields = foundry.data.fields;

class UpgradeItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      armorBonus: new fields.SchemaField({
        defense: new fields.StringField({
          choices: Object.values(E20.defenses),
          initial: 'toughness',
        }),
        value: makeInt(0),
      }),
      availability: new fields.StringField({
        initial: 'standard',
        choices: Object.values(E20.availabilities),
      }),
      benefit: new fields.StringField({initial: ''}),
      traits: new fields.ArrayField(new fields.StringField()),
      type: new fields.StringField({
        initial: 'armor',
        choices: Object.values(E20.upgradeTypes),
      }),
      prerequisite: new fields.StringField({initial: null}),
    };
  }
}
