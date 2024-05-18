import { E20 } from "../../helpers/config.mjs";

import { makeStr, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

const fields = foundry.data.fields;

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
      essenceBonus: new fields.ArrayField(
        makeStrWithChoices(Object.keys(E20.essences)),
      ),
      essenceCost: new fields.ArrayField(
        makeStrWithChoices(Object.keys(E20.essences)),
      ),
      movementCost: makeStr(''),
      selectedEssence: makeStrWithChoices(null, Object.keys(E20.essences)),
      type: makeStrWithChoices('other', Object.keys(E20.alterationTypes)),
    };
  }
}
