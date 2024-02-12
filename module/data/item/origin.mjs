import { item } from './item';
import { itemDescription } from './item-description';
import { parentItem } from './parentItem';

import { makeInt, makeStr, makeStrArray } from "../generic-makers.mjs";

class OriginItemData extends foundry.abstract.DataModel {
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
