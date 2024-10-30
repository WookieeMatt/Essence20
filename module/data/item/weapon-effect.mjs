import { E20 } from "../../helpers/config.mjs";

import { makeInt, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

const fields = foundry.data.fields;

export class WeaponEffectItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      classification: new fields.SchemaField({
        skill: makeStrWithChoices([...Object.keys(E20.skills), 'roleSkillDie'], 'athletics'),
        style: makeStrWithChoices(Object.keys(E20.weaponStyles), 'melee'),
      }),
      damageType: makeStrWithChoices(Object.keys(E20.damageTypes), 'blunt'),
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
