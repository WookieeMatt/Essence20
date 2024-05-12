import { E20 } from "../../../helpers/config.mjs";
import { item } from './item';
import { itemDescription } from './item-description';

import { makeBool, makeInt, makeStrWithChoices } from "../../generic-makers.mjs";

class PowerItemData extends foundry.abstract.DataModel {
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
