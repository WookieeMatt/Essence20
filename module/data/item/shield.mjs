import { E20 } from "../../helpers/config.mjs";

import {
  makeBool,
  makeInt,
  makeStr,
  makeStrArrayWithChoices,
  makeStrWithChoices,
} from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

const fields = foundry.data.fields;

export class ShieldItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      activeEffect: new fields.SchemaField({
        type: makeStrWithChoices(Object.keys(CONFIG.E20.defenses), 'toughness'),
        value: makeInt(0),
      }),
      availability: makeStrWithChoices(Object.keys(E20.availabilities), 'standard'),
      classification: makeStrWithChoices(Object.keys(E20.armorClassifications), 'light'),
      equipped: makeBool(false),
      passiveEffect: new fields.SchemaField({
        type: makeStrWithChoices(Object.keys(CONFIG.E20.defenses), 'toughness'),
        value: makeInt(0),
      }),
      requirements: makeStr(null),
      traits: makeStrArrayWithChoices(Object.keys(E20.armorTraits)),
    }
  }
}
