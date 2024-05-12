import { E20 } from "../../../helpers/config.mjs";
import { item } from './item';
import { itemDescription } from './item-description';

import { makeInt, makeStrWithChoices } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

class RolePointsItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      bonus: fields.SchemaField({
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
        type: makeStrWithChoices('none', E20.bonusTypes),
        value : makeInt(0),
      }),
      isActivatable: makeBool(false),
      isActive: makeBool(false),
      powerCost: makeInt(0),
      resource: fields.SchemaField({
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
