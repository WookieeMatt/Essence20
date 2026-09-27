import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStr, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

const fields = foundry.data.fields;

export class AltModeItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      altModeCrew: makeInt(0),
      altModeFirepoints: makeInt(0),
      altModeMovement: new fields.SchemaField({
        aerial: makeInt(0),
        aquatic: makeInt(0),
        ground: makeInt(0),
      }),
      altModesize: makeStrWithChoices(Object.keys(E20.actorSizes), 'common'),
      // Bot Mode Size (TF CRB Ch.4 Origins, e.g. p.51 Champion: "Size: Large"): the character's
      // system.size while untransformed. Lives on the Alt Mode item (not the Origin) because an
      // Origin with a Bot-Mode-size choice (e.g. Cutter/Outrider "Common or Large") is modeled as
      // one Alt Mode item per choice, same idiom as altModesize above - background-handler.mjs
      // setOriginValues copies whichever one was picked onto the actor on drop.
      botModeSize: makeStrWithChoices(Object.keys(E20.actorSizes), 'common'),
      tokenImage: makeStr(null),
      // Limited Articulation (TF CRB, several Alt Mode Chassis, e.g. p.51): "You cannot use
      // Skills that require articulation or precision, such as Athletics and Finesse" while
      // converted into this Alt Mode. Read off the actor's currently-active Alt Mode item by
      // dice.mjs's own rollSkill (see LIMITED_ARTICULATION_SKILLS' own comment there).
      limitedArticulation: makeBool(false),
    };
  }
}
