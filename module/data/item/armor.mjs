import { item } from './item';
import { itemDescription } from './item-description';
import { makeBool, makeInt, makeStrWithChoices } from "../../generic-makers.mjs";
import { parentItem } from './parentItem';

const fields = foundry.data.fields;

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
      traits: new fields.ArrayField(new fields.StringField()),
      upgradeTraits: new fields.ArrayField(new fields.StringField()),
    };
  }
}
