import { E20 } from "../../helpers/config.mjs";

import { makeStr, makeStrArrayWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';
import { parentItem } from './templates/parent-item.mjs';

const initEssenceLevels = [
  'level1',
  'level10',
];

export class FocusItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      essences: makeStrArrayWithChoices(Object.keys(E20.essences)),
      essenceLevels: makeStrArrayWithChoices(Object.keys(E20.actorLevels), initEssenceLevels),
      roleId: makeStr(''),
      skills: makeStrArrayWithChoices(Object.keys(E20.originSkills)),
    };
  }
}
