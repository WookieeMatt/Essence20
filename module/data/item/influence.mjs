import { item } from './item';
import { itemDescription } from './item-description';
import { parentItem } from './parentItem';

import { makeBool, makeStr, makeStrArray } from "../../generic-makers.mjs";

class InfluenceItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      type: makeStr(''),
      mandatoryHangUp: makeBool(false),
      skills: makeStrArray(),
    };
  }
}
