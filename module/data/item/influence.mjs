import { item } from './item.mjs';
import { itemDescription } from './item-description.mjs';
import { parentItem } from './parentItem.mjs';

import { makeBool, makeStrArray } from "../../generic-makers.mjs";

export class InfluenceItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      mandatoryHangUp: makeBool(false),
      skills: makeStrArray(),
    };
  }
}
