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
      availability: makeStrWithChoices('standard', Object.keys(E20.availabilities)),
      benefit: makeStr(''),
      bonus: makeStr(null),
      bonusSkill: makeStrWithChoices(null, Object.keys(E20.skills)),
      cost: makeStr(null),
      costSkill: makeStrWithChoices(null, Object.keys(E20.skills)),
      essenceBenefit: makeStr(''),
      essenceBonus: makeStrArrayWithChoices(Object.keys(E20.essences)),
      essenceCost: makeStrArrayWithChoices(Object.keys(E20.essences)),
      movementCost: makeStr(''),
      selectedEssence: makeStrWithChoices(null, Object.keys(E20.essences)),
      type: makeStrWithChoices('other', Object.keys(E20.alterationTypes)),
    };
  }
}
