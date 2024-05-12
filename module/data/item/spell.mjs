import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStr, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

export class SpellItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      circle: makeStrWithChoices('aid', Object.keys(E20.spellCircles)),
      cost: makeInt(0),
      duration: makeStr(''),
      isSpecialized: makeBool(false),
      range: makeInt(0),
      tier: makeStrWithChoices('elementary', Object.keys(E20.spellTiers)),
    };
  }
}
