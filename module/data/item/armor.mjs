import { E20 } from "../../helpers/config.mjs";

import {
  makeBool,
  makeInt,
  makeStrArrayWithChoices,
  makeStrWithChoices,
} from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';
import { parentItem } from './templates/parent-item.mjs';

export class ArmorItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      availability: makeStrWithChoices(Object.keys(E20.availabilities), 'standard'),
      bonusEvasion: makeInt(0),
      bonusToughness: makeInt(0),
      classification: makeStrWithChoices(Object.keys(E20.armorClassifications), 'light'),
      equipped: makeBool(false),
      traits: makeStrArrayWithChoices(Object.keys(E20.armorTraits)),
      totalBonusEvasion: makeInt(0),
      totalBonusToughness: makeInt(0),
      upgradeTraits: makeStrArrayWithChoices(Object.keys(E20.armorTraits)),
    };
  }
}
