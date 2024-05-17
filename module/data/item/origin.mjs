import { makeInt, makeStr, makeStrArray } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';
import { parentItem } from './templates/parent-item.mjs';

export class OriginItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      baseAerialMovement: makeInt(0),
      baseAquaticMovement: makeInt(0),
      baseGroundMovement: makeInt(0),
      essences: makeStrArray(),
      languages: makeStr(''),
      skills: makeStrArray(),
      startingHealth: makeInt(0),
    };
  }
}
