import { item } from './item';
import { E20 } from "../../../helpers/config.mjs";
import { makeInt } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

class WeaponEffectItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      classification: new fields.SchemaField({
        skill: new fields.StringField({
          initial: 'athletics',
          choices: Object.values(E20.skills),
        }),
        style: new fields.StringField({
          initial: 'athletics',
          choices: Object.values(E20.weaponStyles),
        }),
      }),
      damageType: new fields.StringField({
        initial: 'athletics',
        choices: Object.values(E20.weaponTypes),
      }),
      damageValue: makeInt(1),
      shiftDown: makeInt(0),
      numHands: makeInt(1),
      numTargets: makeInt(1),
      radius: makeInt(0),
      range: new fields.SchemaField({
        radius: makeInt(null),
        radius: makeInt(0),
        radius: makeInt(null),
        radius: makeInt(null),
      }),
    };
  }
}
