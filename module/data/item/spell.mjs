import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStr, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

export class SpellItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      circle: makeStrWithChoices(Object.keys(E20.spellCircles), 'aid'),
      cost: makeInt(0),
      duration: makeStr(''),
      isSpecialized: makeBool(false),
      range: makeStr(''),
      tier: makeStrWithChoices(Object.keys(E20.spellTiers), 'elementary'),
    };
  }
}
