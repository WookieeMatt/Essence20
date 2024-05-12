import { item } from './item.mjs';
import { itemDescription } from './item-description.mjs';

import { makeStr } from "../../generic-makers.mjs";

export class AlterationItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      availability: makeStr('standard'),
      benefit: makeStr(''),
      bonusSkill: makeStr(''),
      cost: makeStr(''),
      costSkill: makeStr(''),
      essenceBenefit: makeStr(''),
      essenceCost: makeStr(''),
      movementCost: makeStr(''),
      selectedEssence: makeStr(''),
      type: makeStr('other'),
    };
  }
}
