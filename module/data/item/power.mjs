import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

export class PowerItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      actionType: makeStrWithChoices('free', Object.keys(E20.actionTypes)),
      canActivate: makeBool(false),
      hasVariableCost: makeBool(false),
      maxPowerCost: makeInt(null),
      powerCost: makeInt(null),
      selectionLimit: makeInt(1),
      type: makeStrWithChoices('grid', Object.keys(E20.powerTypes)),
      usesInterval: makeStrWithChoices('perScene', Object.keys(E20.usesInterval)),
      usesPer: makeInt(null),
    };
  }
}
