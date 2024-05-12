import { E20 } from "../../helpers/config.mjs";

import { makeInt, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

export class GearItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      quantity: makeInt(1),
      type: makeStrWithChoices('clothes', Object.keys(E20.gearTypes)),
    };
  }
}
