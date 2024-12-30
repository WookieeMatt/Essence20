import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';
import { parentItem } from './templates/parent-item.mjs';
import { makeStr } from "../generic-makers.mjs";

export class FactionItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
    };
  }
}
