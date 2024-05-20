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

export class UpgradeItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      armorBonus: new fields.SchemaField({
        defense: makeStrWithChoices(Object.keys(E20.defenses), 'toughness'),
        value: makeInt(0),
      }),
      availability: makeStrWithChoices(Object.keys(E20.availabilities), 'standard'),
      benefit: makeStr(''),
      traits: makeStrArrayWithChoices(Object.keys(E20.weaponTraits).concat(E20.armorTraits)),
      type: makeStrWithChoices(Object.keys(E20.upgradeTypes), 'armor'),
      prerequisite: makeStr(null),
    };
  }
}
