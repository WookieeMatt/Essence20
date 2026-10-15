import { E20 } from "../../util/config.mjs";

import { makeBool, makeInt, makeStr, makeStrArrayWithChoices, makeStrWithChoices } from "../generic-makers.mjs";

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
        burrow: makeInt(0),
        climb: makeInt(0),
        ground: makeInt(0),
      }),
      // A chassis printed with a choice of movement ("40 feet Ground or 40 feet Aerial" - Monstrosity): each choice,
      // written into altModeMovement when picked (items/shared/alt-mode-chassis.mjs). Empty / one entry: no choice.
      movementOptions: new fields.ArrayField(new fields.SchemaField({
        aerial: makeInt(0),
        aquatic: makeInt(0),
        burrow: makeInt(0),
        climb: makeInt(0),
        ground: makeInt(0),
      })),
      altModesize: makeStrWithChoices(Object.keys(E20.actorSizes), 'common'),
      // Bot Mode Size (TF CRB Ch.4 Origins, e.g. p.51 Champion: "Size: Large"): the character's
      // system.size while untransformed. Lives on the Alt Mode item (not the Origin) because an
      // Origin with a Bot-Mode-size choice (e.g. Cutter/Outrider "Common or Large") is modeled as
      // one Alt Mode item per choice, same idiom as altModesize above - background-handler.mjs
      // setOriginValues copies whichever one was picked onto the actor on drop.
      botModeSize: makeStrWithChoices(Object.keys(E20.actorSizes), 'common'),
      // A chassis printed with a choice of size ("Size: Large or Huge" - Technorganic Secrets' Behemoth, p.37), for either
      // Mode: the sizes it may be. Asked when the Origin is added (background-handler.mjs#chooseModeSizes); the Alt
      // Mode's can be changed later from its row on the sheet. Empty / one entry: no choice.
      altModeSizeOptions: makeStrArrayWithChoices(Object.keys(E20.actorSizes)),
      botModeSizeOptions: makeStrArrayWithChoices(Object.keys(E20.actorSizes)),
      // An Alt Mode size that fixes the Bot Mode's ({long: 'large'} - Saurian, Slitherer: "corresponds to Large Bot Mode").
      botModeSizeFor: new fields.ObjectField(),
      tokenImage: makeStr(null),
      // Limited Articulation (TF CRB, several Alt Mode Chassis, e.g. p.51): no precision
      // Skills (Athletics, Finesse) while converted into this Alt Mode. Read off the actor's currently-active Alt Mode item by
      // dice.mjs's own rollSkill (see LIMITED_ARTICULATION_SKILLS' own comment there).
      limitedArticulation: makeBool(false),
    };
  }

  /**
   * The item sheet sets each Mode's sizes with one trait selector (templates/item/details/altMode.hbs): one size picked
   * is that size, two or more a choice. An item made before then, with just its size, has that one size in the list.
   * Only when this source carries the size itself - a partial update doesn't.
   * @param {Object} source
   * @returns {Object}
   */
  static migrateData(source) {
    for (const [size, options] of [['altModesize', 'altModeSizeOptions'], ['botModeSize', 'botModeSizeOptions']]) {
      if (typeof source?.[size] == 'string' && source[size] && !source[options]?.length) {
        source[options] = [source[size]];
      }
    }

    return super.migrateData(source);
  }

  /**
   * Its sizes changed on the sheet: a size no longer among them becomes the first that is.
   * @inheritDoc
   */
  async _preUpdate(changes, options, user) {
    const allowed = await super._preUpdate?.(changes, options, user);
    if (allowed === false) {
      return false;
    }

    for (const [size, list] of [['altModesize', 'altModeSizeOptions'], ['botModeSize', 'botModeSizeOptions']]) {
      const sizes = changes.system?.[list];
      const current = changes.system?.[size] ?? this[size];
      if (Array.isArray(sizes) && sizes.length && !sizes.includes(current)) {
        changes.system[size] = sizes[0];
      }
    }
  }
}
