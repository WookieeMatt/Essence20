import { E20 } from "../../../helpers/config.mjs";

import { makeInt } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

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
