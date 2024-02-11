import { item } from './item';
import { E20 } from "../../../helpers/config.mjs";

const fields = foundry.data.fields;

class SpecializationItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      isSpecialized: new fields.BooleanField({initial: true}),
      shift: new fields.StringField({
        choices: Object.values(E20.skillRollableShifts),
        initial: 'd20',
      }),
      skill: new fields.StringField({
        choices: Object.values(E20.skills),
        initial: 'athletics',
      }),
    };
  }
}
