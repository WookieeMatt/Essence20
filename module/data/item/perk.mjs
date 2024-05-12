import { E20 } from "../../../helpers/config.mjs";

import { makeInt, makeStrWithChoices } from "../../generic-makers.mjs";

import { item } from './item.mjs';
import { itemDescription } from './item-description.mjs';
import { parentItem } from './parentItem.mjs';

export class PerkItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      prerequisite: makeStr(null),
      selectionLimit: makeInt(1),
      type: makeStrWithChoices('general', E20.perkTypes),
    };
  }
}
