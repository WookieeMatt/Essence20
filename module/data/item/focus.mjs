import { item } from './item.mjs';
import { itemDescription } from './item-description.mjs';

import { makeStr, makeStrArray } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

export class FocusItemData extends foundry.abstract.DataModel {
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
