import { item } from './item';
import { E20 } from "../../../helpers/config.mjs";
import { makeStrWithChoices } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

class SpecializationItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      isSpecialized: new fields.BooleanField({initial: true}),
      shift: makeStrWithChoices('d20', E20.skillRollableShifts),
      skill: makeStrWithChoices('athletics', E20.skills),
    };
  }
}
