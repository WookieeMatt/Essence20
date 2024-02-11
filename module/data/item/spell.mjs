import { item } from './item';
import { E20 } from "../../../helpers/config.mjs";
import { makeInt, makeStr, makeStrWithChoices } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

class SpellItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      circle: makeStrWithChoices('athletics', E20.spellCircles),
      cost: makeInt(0),
      duration: makeStr(''),
      isSpecialized: new fields.BooleanField({initial: false}),
      range: makeInt(0),
      tier: makeStrWithChoices(null, E20.spellTiers),
    };
  }
}
