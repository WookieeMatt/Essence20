import { item } from './item';
import { itemDescription } from './item-description';
import { parentItem } from './parentItem';

import { makeInt, makeStr, makeStrArray } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

class RoleItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      adjustments: new fields.SchemaField({
        health: makeStrArray(),
      }),
      armors: new fields.SchemaField({
        qualified: makeStrArray(),
        trained: makeStrArray(),
      }),
      essenceLevels: new fields.SchemaField({
        smarts: makeStrArray(),
        social: makeStrArray(),
        speed: makeStrArray(),
        strength: makeStrArray(),
      }),
      perkLevels: new fields.SchemaField({
        general: new fields.ArrayField(
          new fields.StringField(),
          {
            initial: [
              "level4",
              "level8",
              "level12",
              "level16",
              "level19",
            ],
          },
        ),
      }),
      powers: new fields.SchemaField({
        personal: new fields.SchemaField({
          increase: makeInt(0),
          levels: makeStrArray(),
          starting: makeInt(0),
        }),
      }),
      skills: makeStrArray(),
      version: makeStr(''),
      weapons: new fields.SchemaField({
        qualified: makeStrArray(),
        trained: makeStrArray(),
      }),
    };
  }
}
