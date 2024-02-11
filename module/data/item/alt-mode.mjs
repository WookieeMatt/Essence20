import { item } from './item';
import { itemDescription } from './item-description';
import { makeInt } from "../../generic-makers.mjs";
import { E20 } from "../../../helpers/config.mjs";

const fields = foundry.data.fields;

class AltModeItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      crew: makeInt(0),
      firepoints: makeInt(0),
      movement: fields.SchemaField({
        aerial: makeInt(0),
        aquatic: makeInt(0),
        ground: makeInt(0),
      }),
      size: new fields.StringField({
        initial: 'common',
        choices: Object.values(E20.actorSizes),
      }),
    };
  }
}
