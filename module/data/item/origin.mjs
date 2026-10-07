import { E20 } from "../../util/config.mjs";

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
      // Kept (checked 2026-10-07): the Power Rangers, G.I. JOE and Transformers core books print a Languages line
      // on each Origin - see docs/rules-batches/role-level-picks.md. MLP and Night Vale Origins have none.
      languages: makeStr(''),
      skills: makeStrArrayWithChoices(Object.keys(E20.originSkills)),
      startingHealth: makeInt(0),
    };
  }
}
