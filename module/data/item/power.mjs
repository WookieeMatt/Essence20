import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStrWithChoices } from "../generic-makers.mjs";

import { rerollSchema } from '../reroll-schema.mjs';
import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

export class PowerItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      actionType: makeStrWithChoices(Object.keys(E20.actionTypes), 'free'),
      canActivate: makeBool(false),
      hasVariableCost: makeBool(false),
      maxPowerCost: makeInt(null),
      powerCost: makeInt(null),
      // Temporal Awareness (Across the Stars, Grid Power, p.73) is the first Power to need this -
      // see helpers/reroll.mjs's own actor.items scan, which has no item.type filter at all and
      // already picks up any item exposing this schema generically, the same way it already does
      // for Perks.
      ...rerollSchema(),
      selectionLimit: makeInt(1),
      type: makeStrWithChoices(Object.keys(E20.powerTypes), 'grid'),
      usesInterval: makeStrWithChoices(Object.keys(E20.usesInterval), 'perScene'),
      usesPer: makeInt(null),
    };
  }
}
