import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStrArray, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

const fields = foundry.data.fields;

export class RolePointsItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      bonus: new fields.SchemaField({
        defenseBonus: new fields.SchemaField({
          cleverness: makeBool(false),
          evasion: makeBool(false),
          toughness: makeBool(false),
          willpower: makeBool(false),
        }),
        increase: makeInt(0),
        level20Value: makeInt(null),
        increaseLevels: makeStrArray(),
        startingValue: makeInt(null),
        type: makeStrWithChoices(Object.keys(E20.bonusTypes), 'none'),
        value : makeInt(0),
      }),
      isActivatable: makeBool(false),
      isActive: makeBool(false),
      powerCost: makeInt(0),
      resource: new fields.SchemaField({
        increase: makeInt(0),
        level20Value: makeInt(null),
        level20ValueIsUnlimited: makeBool(false),
        increaseLevels: makeStrArray(),
        max: makeInt(null),
        startingValue: makeInt(null),
        value : makeInt(0),
      }),
    };
  }
}
