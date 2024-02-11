import { item } from './item';
import { itemDescription } from './item-description';
import { makeInt, makeStr } from "../../generic-makers.mjs";
import { parentItem } from './parentItem';

const fields = foundry.data.fields;

class RoleItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      adjustments: new fields.SchemaField({
        health: new fields.ArrayField(new fields.StringField()),
      }),
      armors: new fields.SchemaField({
        qualified: new fields.ArrayField(new fields.StringField()),
        trained: new fields.ArrayField(new fields.StringField()),
      }),
      essenceLevels: new fields.SchemaField({
        smarts: new fields.ArrayField(new fields.StringField()),
        social: new fields.ArrayField(new fields.StringField()),
        speed: new fields.ArrayField(new fields.StringField()),
        strength: new fields.ArrayField(new fields.StringField()),
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
          levels: new fields.ArrayField(new fields.StringField()),
          starting: makeInt(0),
        }),
      }),
      skills: new fields.ArrayField(new fields.StringField()),
      version: makeStr(''),
      weapons: new fields.SchemaField({
        qualified: new fields.ArrayField(new fields.StringField()),
        trained: new fields.ArrayField(new fields.StringField()),
      }),
    };
  }
}
