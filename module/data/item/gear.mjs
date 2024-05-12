import { E20 } from "../../../helpers/config.mjs";
import { item } from './item';
import { itemDescription } from './item-description';

import { makeInt } from "../generic-makers.mjs";

class GearItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      quantity: makeInt(1),
      type: makeStrWithChoices('clothes', E20.gearTypes),
    };
  }
}
