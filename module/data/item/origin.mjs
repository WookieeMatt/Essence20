import { E20 } from "../../helpers/config.mjs";

import { makeInt, makeStr, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';
import { parentItem } from './templates/parent-item.mjs';

const fields = foundry.data.fields;

export class OriginItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      baseAerialMovement: makeInt(0),
      baseAquaticMovement: makeInt(0),
      baseGroundMovement: makeInt(0),
      essences: new fields.ArrayField(
        makeStrWithChoices(Object.keys(E20.essences)),
      ),
      languages: makeStr(''),
      skills: new fields.ArrayField(
        makeStrWithChoices(Object.keys(E20.originSkills)),
      ),
      startingHealth: makeInt(0),
    };
  }
}
