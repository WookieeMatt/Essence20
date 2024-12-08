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

const fields = foundry.data.fields;

export class WeaponItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      availability: makeStrWithChoices(Object.keys(E20.availabilities), 'standard'),
      classification: new fields.SchemaField({
        size: makeStrWithChoices(Object.keys(E20.weaponSizes), 'integrated'),
      }),
      equipped: makeBool(true),
      isPoison: makeBool(false),
      poisonType: makeStrWithChoices(Object.keys(E20.poisonTypes)),
      poisonSubType: new fields.SchemaField({
        contact: makeBool (false),
        ingested: makeBool (false),
        inhaled: makeBool (false),
      }),
      requirements: new fields.SchemaField({
        custom: makeStr(null),
        skill: makeStrWithChoices(Object.keys(E20.skills), null),
        shift: makeStrWithChoices(E20.weaponRequirementShifts, null),
      }),
      traits: makeStrArrayWithChoices(Object.keys(E20.weaponTraits)),
      transformerMode : makeStrWithChoices(E20.transformerModes, 'modeBotMode'),
      upgradeTraits: makeStrArrayWithChoices(Object.keys(E20.weaponTraits)),
      usesPerScene: makeInt(null),
    };
  }
}
