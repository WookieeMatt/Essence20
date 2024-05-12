import { E20 } from "../../../helpers/config.mjs";

import { makeInt, makeStrWithChoices } from "../../generic-makers.mjs";

import { item } from './item.mjs';

const fields = foundry.data.fields;

export class WeaponEffectItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      classification: new fields.SchemaField({
        skill: makeStrWithChoices('athletics', E20.skills),
        style: makeStrWithChoices('melee', E20.weaponStyles),
      }),
      damageType: makeStrWithChoices('blunt', E20.damageTypes),
      damageValue: makeInt(1),
      shiftDown: makeInt(0),
      numHands: makeInt(1),
      numTargets: makeInt(1),
      radius: makeInt(0),
      range: new fields.SchemaField({
        min: makeInt(null),
        reachMultiplier: makeInt(0),
        long: makeInt(null),
        value: makeInt(null),
      }),
    };
  }
}
