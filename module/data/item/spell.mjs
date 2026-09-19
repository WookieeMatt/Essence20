import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStr, makeStrWithChoices } from "../generic-makers.mjs";

import { aoeSchema } from "../aoe-schema.mjs";
import { attackSchema } from "../attack-schema.mjs";
import { durationSchema, formatDuration } from "../duration-schema.mjs";
import { activation } from './templates/activation.mjs';
import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

export class SpellItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...activation(),
      ...itemDescription(),
      // Area of Effect shape + radius - see module/data/aoe-schema.mjs. Set on a spell that
      // targets an area rather than a creature (e.g. Explosive Beam, MLP CRB p.137).
      ...aoeSchema(),
      circle: makeStrWithChoices(Object.keys(E20.spellCircles), 'aid'),
      cost: makeInt(0),
      // An attack spell's own damage, and the Defense its Spellcasting Attack Test is rolled
      // against (p.168-169). Null/0 for the majority of spells, which aren't attacks at all -
      // dice.mjs only builds its per-target Defense comparison when a Defense is actually set, so
      // an ordinary utility spell is unaffected by these existing.
      //
      // Before these fields existed, every damaging spell had to be hardcoded into dice.mjs by
      // compendium id (Energy Beam, Lancing Beam, Explosive Beam, Beam Volley, Fireball...), which
      // meant a GM's own homebrew attack spell could never deal damage at all. dice.mjs still
      // carries those legacy per-id entries; authored values here take precedence over them.
      ...attackSchema(),
      // Structured, not the free text this used to be - see module/data/duration-schema.mjs.
      ...durationSchema(),
      isSpecialized: makeBool(false),
      range: makeStr(''),
      tier: makeStrWithChoices(Object.keys(E20.spellTiers), 'elementary'),
    };
  }

  prepareDerivedData() {
    // Duration used to be a plain string that templates could interpolate directly; now that it's
    // structured, the readable form is built here once rather than in each of the several places
    // that show it (the sheet chip, the item sheet, chat output).
    this.durationLabel = formatDuration(this.duration);

    return super.prepareDerivedData();
  }
}
