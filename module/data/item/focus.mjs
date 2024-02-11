import { item } from './item';
import { itemDescription } from './item-description';

import { makeStr, makeStrArray } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

class FocusItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      essences: makeStr(''),
      essenceLevels: new fields.ArrayField(
        new fields.StringField(),
        {
          initial: [
            'level1',
            'level10',
          ],
        },
      ),
      roleId: makeStr(''),
      skills: makeStrArray(),
    };
  }
}
