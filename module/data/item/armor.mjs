import { E20 } from "../../../helpers/config.mjs";
import { item } from './item.mjs';
import { itemDescription } from './item-description.mjs';
import { parentItem } from './parentItem.mjs';

import { makeBool, makeInt, makeStrArray, makeStrWithChoices } from "../../generic-makers.mjs";

export class ArmorItemData extends foundry.abstract.DataModel {
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
