import { E20 } from "../../../helpers/config.mjs";

import { makeBool, makeStr, makeStrArray, makeStrWithChoices } from "../../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';
import { parentItem } from './templates/parentItem.mjs';

const fields = foundry.data.fields;

export class UpgradeItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      alternateEffects: makeStr(''),
      availability: makeStrWithChoices('standard', E20.availabilities),
      classification: makeStrWithChoices('integrated', E20.weaponSizes),
      equipped: makeBool(true),
      requirements: new fields.SchemaField({
        custom: makeStr(null),
        skill: makeStrWithChoices(null, E20.skills),
        shift: makeStrWithChoices(null, E20.skillRollableShifts),
      }),
      traits: makeStrArray(),
      upgradeTraits: makeStrArray(),
      usesPerScene: makeInt(null),
    };
  }
}
