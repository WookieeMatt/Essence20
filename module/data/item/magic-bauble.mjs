import { E20 } from "../../helpers/config.mjs";

import { makeStr, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

export class MagicBaubleItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      duration: makeStr(''),
      range: makeStr(''),
      spellcastingShift: makeStrWithChoices(E20.skillShifts, 'd2'),
    };
  }
}
