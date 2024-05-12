import { item } from './item';
import { itemDescription } from './item-description';

import { makeStr } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

class AlterationItemData extends foundry.abstract.DataModel {
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
