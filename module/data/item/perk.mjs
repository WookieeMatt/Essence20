import { item } from './item';
import { itemDescription } from './item-description';
import { parentItem } from './parentItem';
import { E20 } from "../../../helpers/config.mjs";
import { makeInt } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

class PerkItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      prerequisite: new fields.StringField({initial: null}),
      selectionLimit: makeInt(1),
      type: new fields.StringField({
        choices: Object.values(E20.perkTypes),
        initial: 'general',
      }),
    };
  }
}
