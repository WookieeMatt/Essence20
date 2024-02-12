import { E20 } from "../../../helpers/config.mjs";
import { item } from './item';
import { itemDescription } from './item-description';

import { makeBool, makeInt, makeStr, makeStrWithChoices } from "../../generic-makers.mjs";

class SpellItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      circle: makeStrWithChoices('athletics', E20.spellCircles),
      cost: makeInt(0),
      duration: makeStr(''),
      isSpecialized: makeBool(false),
      range: makeInt(0),
      tier: makeStrWithChoices(null, E20.spellTiers),
    };
  }
}
