import { E20 } from "../../helpers/config.mjs";

import {
  makeBool,
  makeInt,
  makeStr,
  makeStrArrayWithChoices,
} from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';
import { parentItem } from './templates/parent-item.mjs';

export class OriginItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      baseAerialMovement: makeInt(0),
      baseAquaticMovement: makeInt(0),
      baseGroundMovement: makeInt(0),
      essences: makeStrArrayWithChoices(Object.keys(E20.essences)),
      // True for Origins (e.g. Power Rangers CRB's) whose "Bonus Skill Ranks" list is granted in
      // full - every skill acquires a d2/a Specialization - rather than the player picking one.
      allSkillsGranted: makeBool(false),
      languages: makeStr(''),
      skills: makeStrArrayWithChoices(Object.keys(E20.originSkills)),
      startingHealth: makeInt(0),
    };
  }
}
