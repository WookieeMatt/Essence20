import { E20 } from "../../../helpers/config.mjs";
import { item } from './item.mjs';
import { itemDescription } from './item-description.mjs';

import { makeInt } from "../generic-makers.mjs";

export class GearItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      quantity: makeInt(1),
      type: makeStrWithChoices('clothes', E20.gearTypes),
    };
  }
}
