import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStrArray, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';
import { parentItem } from './templates/parent-item.mjs';

export class ArmorItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      availability: makeStrWithChoices('standard', Object.keys(E20.availabilities)),
      bonusEvasion: makeInt(0),
      bonusToughness: makeInt(0),
      classification: makeStrWithChoices('light', Object.keys(E20.armorClassifications)),
      equipped: makeBool(false),
      traits: makeStrArray(),
      upgradeTraits: makeStrArray(),
    };
  }
}
