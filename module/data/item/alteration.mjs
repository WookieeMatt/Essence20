import { E20 } from "../../helpers/config.mjs";

import {
  makeInt,
  makeStr,
  makeStrArrayWithChoices,
  makeStrWithChoices,
} from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

const fields = foundry.data.fields;

export class AlterationItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      availability: makeStrWithChoices(Object.keys(E20.availabilities), 'standard'),
      benefit: makeStr(''),
      bonus: makeStr(null),
      bonusMovement: makeInt(null),
      bonusMovementType: makeStrWithChoices(Object.keys(E20.movementTypes), null),
      bonusSkill: makeStrWithChoices(Object.keys(E20.skills), null),
      cost: makeStr(null),
      costMovement: makeInt(null),
      costMovementType: makeStrWithChoices(Object.keys(E20.movementTypes), null),
      costSkill: makeStrWithChoices(Object.keys(E20.skills), null),
      essenceBenefit: makeStr(''),
      essenceBonus: makeStrArrayWithChoices(Object.keys(E20.essences)),
      essenceCost: makeStrArrayWithChoices(Object.keys(E20.essences)),
      movementCost: new fields.ObjectField({}),
      selectedEssence: makeStrWithChoices(Object.keys(E20.essences), null),
      type: makeStrWithChoices(Object.keys(E20.alterationTypes), 'other'),
    };
  }
}
