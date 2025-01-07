import { E20 } from "../../helpers/config.mjs";

import { makeInt, makeStr, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';
import { parentItem } from './templates/parent-item.mjs';
import { itemPrerequisites } from "./templates/item-prerequisites.mjs";

export class PerkItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...itemPrerequisites(),
      ...parentItem(),
      prerequisite: makeStr(null),
      selectionLimit: makeInt(1),
      type: makeStrWithChoices(Object.keys(E20.perkTypes), 'general'),
    };
  }
}
