import { makeStr } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

export class AlterationItemData extends foundry.abstract.TypeDataModel {
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
