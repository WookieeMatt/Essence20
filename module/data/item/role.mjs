import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStr, makeStrArray, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';
import { parentItem } from './templates/parent-item.mjs';

const fields = foundry.data.fields;

export class RoleItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      adjustments: new fields.SchemaField({
        health: makeStrArray(),
      }),
      armors: new fields.SchemaField({
        qualified: new fields.ArrayField(
          makeStrWithChoices(Object.keys(E20.armorTypes)),
        ),
        trained: new fields.ArrayField(
          makeStrWithChoices(Object.keys(E20.armorTypes)),
        ),
      }),
      essenceLevels: new fields.SchemaField({
        smarts: makeStrArray(),
        social: makeStrArray(),
        speed: makeStrArray(),
        strength: makeStrArray(),
      }),
      gridPowerLevels: new fields.ArrayField(
        new fields.StringField(),
        {
          initial: [
            "level6",
            "level11",
            "level16",
          ],
        },
      ),
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
          regeneration: makeInt(0),
          starting: makeInt(0),
        }),
      }),
      skillDie: new fields.SchemaField({
        isUsed: makeBool(false),
        name: makeStr(''),
        levels: makeStrArray(),
        specializedLevels: makeStrArray(),
      }),
      skills: new fields.ArrayField(
        makeStrWithChoices(Object.keys(E20.originSkills)),
      ),
      version: makeStr(''),
      weapons: new fields.SchemaField({
        qualified: new fields.ArrayField(
          makeStrWithChoices(Object.keys(E20.weaponTypes)),
        ),
        trained: new fields.ArrayField(
          makeStrWithChoices(Object.keys(E20.weaponTypes)),
        ),
      }),
    };
  }
}
