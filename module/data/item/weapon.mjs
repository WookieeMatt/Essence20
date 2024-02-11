import { item } from './item';
import { E20 } from "../../../helpers/config.mjs";
import { parentItem } from './parentItem';

const fields = foundry.data.fields;

class UpgradeItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      classFeatureId: new fields.StringField({initial: null}),
      alternateEffects: new fields.StringField({initial: ''}),
      availability: new fields.StringField({
        initial: 'standard',
        choices: Object.values(E20.availabilities),
      }),
      classification: new fields.SchemaField({
        size: new fields.StringField({
          choices: Object.values(E20.weaponSizes),
          initial: 'integrated',
        }),
      }),
      equipped: new fields.BooleanField({initial: true}),
      requirements: new fields.SchemaField({
        custom: new fields.StringField({initial: null}),
        skill: new fields.StringField({
          initial: null,
          choices: Object.values(E20.skills),
        }),
        shift: new fields.StringField({
          choices: Object.values(E20.skillRollableShifts),
          initial: null,
        }),
      }),
      traits: new fields.ArrayField(new fields.StringField()),
      upgradeTraits: new fields.ArrayField(new fields.StringField()),
      usesPerScene: new fields.NumberField({
        initial: null,
        integer: true,
      }),
    };
  }
}
