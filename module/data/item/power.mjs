import { E20 } from "../../../helpers/config.mjs";

import { makeBool, makeInt, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

export class PowerItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      actionType: makeStrWithChoices('free', E20.actionTypes),
      canActivate: makeBool(false),
      hasVariableCost: makeBool(false),
      maxPowerCost: makeInt(null),
      powerCost: makeInt(null),
      selectionLimit: makeInt(1),
      type: makeStrWithChoices('grid', E20.powerTypes),
      usesInterval: makeStrWithChoices('perScene', E20.usesInterval),
      usesPer: makeInt(null),
    };
  }
}
