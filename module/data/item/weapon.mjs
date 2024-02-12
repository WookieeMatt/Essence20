import { E20 } from "../../../helpers/config.mjs";
import { item } from './item';
import { itemDescription } from './item-description';
import { parentItem } from './parentItem';

import { makeBool, makeStr, makeStrArray, makeStrWithChoices } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

class UpgradeItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      classFeatureId: makeStr(null),
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
