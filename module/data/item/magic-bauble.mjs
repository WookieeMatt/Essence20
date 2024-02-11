import { item } from './item';
import { itemDescription } from './item-description';

import { makeStr, makeStrWithChoices } from "../../generic-makers.mjs";

class MagicBaubleItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      duration: makeStr(''),
      range: makeStr(''),
      spellcastingShift: makeStrWithChoices('d2', E20.skillRollableShifts),
    };
  }
}
