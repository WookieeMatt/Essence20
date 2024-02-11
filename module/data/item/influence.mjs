import { item } from './item';
import { itemDescription } from './item-description';
import { parentItem } from './parentItem';
import { makeBool, makeStr } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

class InfluenceItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      type: makeStr(''),
      mandatoryHangUp: makeBool(false),
      skills: new fields.ArrayField(new fields.StringField()),
    };
  }
}
