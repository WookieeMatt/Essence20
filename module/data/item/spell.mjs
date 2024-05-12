import { E20 } from "../../../helpers/config.mjs";

import { makeBool, makeInt, makeStr, makeStrWithChoices } from "../../generic-makers.mjs";

import { item } from './item.mjs';
import { itemDescription } from './item-description.mjs';

export class SpellItemData extends foundry.abstract.DataModel {
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
