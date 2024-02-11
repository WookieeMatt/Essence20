import { item } from './item';
import { itemDescription } from './item-description';
import { parentItem } from './parentItem';
import { makeInt } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

class ArmorItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      size: new fields.StringField({
        initial: 'standard',
        choices: Object.values(E20.actorSizes),
      }),
      crew: makeInt(),
    };
  }
}
