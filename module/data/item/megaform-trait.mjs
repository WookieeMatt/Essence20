import { E20 } from "../../helpers/config.mjs";

import { makeInt, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

export class MegaformTraitItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      type: makeStrWithChoices(Object.keys(E20.megaformTraitTypes), 'coreAbility'),
      // Only used by the Core Ability type: which of the Megaform's two ability scores it boosts.
      essence: makeStrWithChoices(['strength', 'speed'], 'strength'),
      // Only used by the Move type: which Megaform movement type it grants/boosts.
      movementType: makeStrWithChoices(Object.keys(E20.movementTypes), 'ground'),
      // The magnitude of the effect: Essence/Toughness/Evasion bonus for Core Ability and
      // Core Defenses (normally 1 per RAW), or feet of movement for Move (normally 10ft
      // added to an existing type, or 45ft for a brand new type).
      value: makeInt(1),
    };
  }
}
