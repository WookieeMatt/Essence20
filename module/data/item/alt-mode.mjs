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
      crew: makeInt(),
      firepoints: makeInt(),
      movement: fields.SchemaField({
        aerial: makeInt(),
        aquatic: makeInt(),
        ground: makeInt(),
      }),
      size: new fields.StringField({
        initial: 'common',
        choices: Object.values(E20.actorSizes),
      }),
    };
  }
}
