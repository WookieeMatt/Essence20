import { E20 } from "../../helpers/config.mjs";

import { makeInt, makeStr, makeStrWithChoices } from "../generic-makers.mjs";

import { durationSchema, formatDuration } from "../duration-schema.mjs";
import { activation } from './templates/activation.mjs';
import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

export class MagicBaubleItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...activation(),
      ...itemDescription(),
      ...durationSchema(),
      // How many of this bauble the holder has. Same field gear declares, but unlike gear's - which
      // is a purely manual count - this one is decremented automatically when the bauble is used
      // (MLP CRB p.143, see Essence20Item#roll).
      quantity: makeInt(1),
      range: makeStr(''),
      spellcastingShift: makeStrWithChoices(E20.skillShifts, 'd2'),
    };
  }

  /** @override */
  prepareDerivedData() {
    // Same readable form spell and power build - see SpellItemData#prepareDerivedData. A bauble's
    // duration was the last free-text one left, which meant a "3 rounds" Scrapbug could never
    // expire the way an equivalent spell does.
    this.durationLabel = formatDuration(this.duration);

    return super.prepareDerivedData();
  }
}
