import { E20 } from "../../util/config.mjs";

import { makeInt, makeStr, makeStrWithChoices } from "../generic-makers.mjs";

import { aoeSchema } from "../aoe-schema.mjs";
import { attackSchema } from "../attack-schema.mjs";
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
      // What kind of bauble it is (MLP CRB p.141, Using Magic Baubles) - each is used differently
      // (documents/item.mjs's magicBauble branch): a scroll is cast with a Spellcasting Skill Test;
      // a potion affects whoever drinks it and needs no test; a talisman needs no test but costs its
      // user the spell's casting cost as a Spellcasting downshift. Defaults to scroll, the one that
      // rolls - what every bauble did before this field existed.
      form: makeStrWithChoices(Object.keys(E20.baubleForms), 'scroll'),
      // A talisman's downshift: the casting cost of the spell inside it ("it does cost the user the
      // same downshift as if they had cast the spell themselves").
      castingCost: makeInt(0),
      // A bauble made from an attack or area spell keeps the spell's attack (items/magic/craft-bauble.mjs) - the
      // same fields a spell has (data/attack-schema.mjs, data/aoe-schema.mjs).
      ...attackSchema(),
      ...aoeSchema(),
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
