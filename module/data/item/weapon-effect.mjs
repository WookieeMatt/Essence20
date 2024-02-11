import { item } from './item';
import { E20 } from "../../../helpers/config.mjs";
import { makeInt, makeStrWithChoices } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

class WeaponEffectItemData extends foundry.abstract.DataModel {
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
        radius: makeInt(null),
        radius: makeInt(0),
        radius: makeInt(null),
        radius: makeInt(null),
      }),
    };
  }
}
