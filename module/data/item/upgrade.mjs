import { item } from './item';
import { E20 } from "../../../helpers/config.mjs";
import { makeInt, makeStr, makeStrWithChoices } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

class UpgradeItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      armorBonus: new fields.SchemaField({
        defense: makeStrWithChoices('toughness', E20.defenses),
        value: makeInt(0),
      }),
      availability: makeStrWithChoices('standard', E20.availabilities),
      benefit: makeStr(''),
      traits: new fields.ArrayField(new fields.StringField()),
      type: makeStrWithChoices('armor', E20.upgradeTypes),
      prerequisite: new fields.StringField({initial: null}),
    };
  }
}
