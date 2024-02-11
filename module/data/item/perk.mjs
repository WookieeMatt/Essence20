import { item } from './item';
import { itemDescription } from './item-description';
import { parentItem } from './parentItem';
import { E20 } from "../../../helpers/config.mjs";
import { makeInt, makeStrWithChoices } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

class PerkItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      prerequisite: new fields.StringField({initial: null}),
      selectionLimit: makeInt(1),
      type: makeStrWithChoices('general', E20.perkTypes),
    };
  }
}
