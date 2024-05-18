import { E20 } from "../../helpers/config.mjs";

import {
  makeStr,
  makeStrArrayWithChoices,
  makeStrWithChoices,
} from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

export class AlterationItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      availability: makeStrWithChoices(Object.keys(E20.availabilities), 'standard'),
      benefit: makeStr(''),
      bonus: makeStr(null),
      bonusSkill: makeStrWithChoices(Object.keys(E20.skills), null),
      cost: makeStr(null),
      costSkill: makeStrWithChoices(Object.keys(E20.skills), null),
      essenceBenefit: makeStr(''),
      essenceBonus: makeStrArrayWithChoices(Object.keys(E20.essences)),
      essenceCost: makeStrArrayWithChoices(Object.keys(E20.essences)),
      movementCost: makeStr(''),
      selectedEssence: makeStrWithChoices(Object.keys(E20.essences), null),
      type: makeStrWithChoices(Object.keys(E20.alterationTypes), 'other'),
    };
  }
}
