import { E20 } from "../../helpers/config.mjs";

import {
  makeInt,
  makeStr,
  makeStrArrayWithChoices,
  makeStrWithChoices,
} from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

const fields = foundry.data.fields;

export class UpgradeItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      aimShiftBonus: makeInt(0),
      armorBonus: new fields.SchemaField({
        defense: makeStrWithChoices(Object.keys(E20.defenses), 'toughness'),
        value: makeInt(0),
      }),
      availability: makeStrWithChoices(Object.keys(E20.availabilities), 'standard'),
      benefit: makeStr(''),
      traits: makeStrArrayWithChoices(Object.keys(E20.upgradeTraits)),
      /* Traits this upgrade takes AWAY from whatever it is attached to. Rare but real: Ammo
         Feeder (GI Joe CRB p.151) is "Weapon with the Reload trait / The weapon loses the Reload
         trait", and Factions in Action Vol. 2 p.96 has a weapon upgrade that drops Mounted.
         Same choices as `traits` above, since anything grantable is also removable. */
      removedTraits: makeStrArrayWithChoices(Object.keys(E20.upgradeTraits)),
      type: makeStrWithChoices(Object.keys(E20.upgradeTypes), 'armor'),
      prerequisite: makeStr(null),
    };
  }
}
