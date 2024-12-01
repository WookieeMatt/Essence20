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
import { parentItem } from './templates/parent-item.mjs';

function makeOptionFields() {
  return new fields.SchemaField({
    defense: makeStrWithChoices(Object.keys(CONFIG.E20.defenses), 'toughness'),
    other: makeStr(''),
    value: makeInt(0),
  });
}

const fields = foundry.data.fields;

export class ShieldItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      active: makeBool(false),
      activeEffect: new fields.SchemaField({
        option1: makeOptionFields(),
        option2: makeOptionFields(),
        other: makeStr(null),
        type: makeStrWithChoices(Object.keys(CONFIG.E20.shieldEffectTypes)),
      }),
      availability: makeStrWithChoices(Object.keys(E20.availabilities), 'standard'),
      classification: makeStrWithChoices(Object.keys(E20.armorClassifications), 'light'),
      equipped: makeBool(false),
      passiveEffect: new fields.SchemaField({
        option1: makeOptionFields(),
        option2: makeOptionFields(),
        other: makeStr(null),
        type: makeStrWithChoices(Object.keys(CONFIG.E20.shieldEffectTypes)),
      }),
      requirements: makeStr(null),
      traits: makeStrArrayWithChoices(Object.keys(E20.armorTraits)),
    };
  }
}
