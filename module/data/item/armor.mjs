import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';
import { parentItem } from './templates/parent-item.mjs';

const fields = foundry.data.fields;

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
      traits: new fields.ArrayField(
        makeStrWithChoices(Object.keys(E20.armorTraits)),
      ),
      upgradeTraits: new fields.ArrayField(
        makeStrWithChoices(Object.keys(E20.armorTraits)),
      ),
    };
  }
}
