import { E20 } from "../../helpers/config.mjs";

import {
  makeBool,
  makeInt,
  makeStr,
  makeStrArray,
  makeStrArrayWithChoices,
  makeStrWithChoices,
} from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';
import { parentItem } from './templates/parent-item.mjs';

const fields = foundry.data.fields;
const initGridPowerLevels = [
  "level6",
  "level11",
  "level16",
];
const initPerkLevels = [
  "level4",
  "level8",
  "level12",
  "level16",
  "level19",
];

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
        qualified: makeStrArrayWithChoices(Object.keys(E20.armorTypes)),
        trained: makeStrArrayWithChoices(Object.keys(E20.armorTypes)),
      }),
      essenceLevels: new fields.SchemaField({
        smarts: makeStrArrayWithChoices(Object.keys(E20.actorLevels)),
        social: makeStrArrayWithChoices(Object.keys(E20.actorLevels)),
        speed: makeStrArrayWithChoices(Object.keys(E20.actorLevels)),
        strength: makeStrArrayWithChoices(Object.keys(E20.actorLevels)),
      }),
      gridPowerLevels: makeStrArrayWithChoices(Object.keys(E20.actorLevels), initGridPowerLevels),
      perkLevels: makeStrArrayWithChoices(Object.keys(E20.actorLevels), initPerkLevels),
      powers: new fields.SchemaField({
        personal: new fields.SchemaField({
          increase: makeInt(0),
          levels: makeStrArrayWithChoices(Object.keys(E20.actorLevels)),
          regeneration: makeInt(0),
          starting: makeInt(0),
        }),
      }),
      skillDie: new fields.SchemaField({
        isUsed: makeBool(false),
        name: makeStr(''),
        levels: makeStrArrayWithChoices(Object.keys(E20.actorLevels)),
        specializedLevels: makeStrArrayWithChoices(Object.keys(E20.actorLevels)),
      }),
      skills: makeStrArrayWithChoices(Object.keys(E20.originSkills)),
      version: makeStrWithChoices(Object.keys(E20.gameVersions), 'powerRangers'),
      weapons: new fields.SchemaField({
        qualified: makeStrArrayWithChoices(Object.keys(E20.weaponTypes)),
        trained: makeStrArrayWithChoices(Object.keys(E20.weaponTypes)),
      }),
    };
  }
}
