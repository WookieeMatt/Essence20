import { item } from './item';
import { itemDescription } from './item-description';
import { parentItem } from './parentItem';

import { makeBool, makeInt, makeStrArray, makeStrWithChoices } from "../../generic-makers.mjs";

class ArmorItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      availability: makeStrWithChoices('standard', E20.availabilities),
      bonusEvasion: makeInt(0),
      bonusToughness: makeInt(0),
      classification: makeStrWithChoices('light', E20.armorClassifications),
      equipped: makeBool(false),
      traits: makeStrArray(),
      upgradeTraits: makeStrArray(),
    };
  }
}
