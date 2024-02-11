import { item } from './item';
import { E20 } from "../../../helpers/config.mjs";
import { makeBool, makeStrWithChoices } from "../../generic-makers.mjs";

class SpecializationItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      isSpecialized: makeBool(true),
      shift: makeStrWithChoices('d20', E20.skillRollableShifts),
      skill: makeStrWithChoices('athletics', E20.skills),
    };
  }
}
