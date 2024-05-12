import { E20 } from "../../../helpers/config.mjs";

import { makeInt, makeStr, makeStrArray, makeStrWithChoices } from "../../generic-makers.mjs";

import { item } from './item.mjs';
import { itemDescription } from './item-description.mjs';

const fields = foundry.data.fields;

export class UpgradeItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      armorBonus: new fields.SchemaField({
        defense: makeStrWithChoices('toughness', E20.defenses),
        value: makeInt(0),
      }),
      availability: makeStrWithChoices('standard', E20.availabilities),
      benefit: makeStr(''),
      traits: makeStrArray(),
      type: makeStrWithChoices('armor', E20.upgradeTypes),
      prerequisite: makeStr(null),
    };
  }
}
