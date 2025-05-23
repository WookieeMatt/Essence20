import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStr, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';
import { parentItem } from './templates/parent-item.mjs';

const fields = foundry.data.fields;

export class PerkItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      advances: new fields.SchemaField({
        baseValue: makeInt(1),
        canAdvance: makeBool(false),
        currentValue: makeInt(0),
        increaseValue: makeInt(1),
        type: makeStrWithChoices(Object.keys(E20.perkAdvanceTypes)),
      }),
      canActivate: makeBool(false),
      choice: makeStr(null),
      choiceType: makeStrWithChoices(Object.keys(E20.perkChoiceTypes), 'none'),
      isRoleVariant: makeBool(false),
      hasChoice: makeBool(false),
      hasMorphedToughnessBonus: makeBool(false),
      numChoices : makeInt(1),
      prerequisite: makeStr(null),
      selectionLimit: makeInt(1),
      type: makeStrWithChoices(Object.keys(E20.perkTypes), 'general'),
      value: makeInt(0),
      version: makeStrWithChoices(Object.keys(E20.gameVersions), 'powerRangers'),
    };
  }
}
