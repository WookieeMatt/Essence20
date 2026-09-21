import { E20 } from "../../helpers/config.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';
import { parentItem } from './templates/parent-item.mjs';
import { makeStr, makeStrWithChoices } from "../generic-makers.mjs";

export class EquipmentPackageItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      alternateAccess: makeStr(null),
      // Which Equipment Assignment bucket this package represents (GI Joe CRB p.136-138 / TF
      // CRB p.114-115 / PR CRB p.103). Stamped onto each granted Item's
      // flags.essence20.equipmentPackage on drop so the sheet can show where the gear came from.
      packageType: makeStrWithChoices(Object.keys(E20.equipmentPackageTypes), 'personal'),
    };
  }
}
