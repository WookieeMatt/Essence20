import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStr, makeStrWithChoices, makeStrArrayWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';
import { parentItem } from './templates/parent-item.mjs';

export class PerkItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      canActivate: makeBool(false),
      choice: makeStr(null),
      choiceType: makeStrWithChoices(Object.keys(E20.perkChoiceTypes), 'none'),
      isRoleVariant: makeBool(false),
      hasMorphedToughnessBonus: makeBool(false),
     numChoices : makeInt(1),
      prerequisite: makeStr(null),
      selectionLimit: makeInt(1),
      type: makeStrWithChoices(Object.keys(E20.perkTypes), 'general'),
      value: makeInt(0),
      valueLevels: makeStrArrayWithChoices(Object.keys(E20.actorLevels)),
      version: makeStrWithChoices(Object.keys(E20.gameVersions), 'powerRangers'),
    };
  }
}
