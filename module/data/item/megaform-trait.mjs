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
      // Only used by the Core Ability type: which Essence Score it boosts. Power Rangers' Core
      // Ability only ever names Strength/Speed in practice, but Transformers' identically-shaped
      // Core Essence Combiner Feature (Enigma of Combination, p.42) can target any of the four,
      // so all four are offered here rather than just the two PR content actually uses.
      essence: makeStrWithChoices(['strength', 'speed', 'smarts', 'social'], 'strength'),
      // Only used by the Skill Expertise type (Enigma of Combination, p.42): which Skill gets the
      // flat bonus. RAW has a single Skill Expertise grant choose two Skills - modeled the same
      // way Accurate Combiner's own "may be taken twice" already is, as two separate items rather
      // than a multi-select field.
      skill: makeStrWithChoices(Object.keys(E20.skills), 'athletics'),
      // Only used by the Move type: which Megaform movement type it grants/boosts.
      movementType: makeStrWithChoices(Object.keys(E20.movementTypes), 'ground'),
      // Only used by the Accurate Combiner type (Across the Stars, p.104): whether this
      // participant's melee or ranged attacks get the ↑1 when the Megaform calls on them. RAW
      // lets a Zord take this trait twice (once per attack type) - modeled as two separate items,
      // the same "multiple instances" shape Core Ability/Core Defenses already use.
      attackType: makeStrWithChoices(['melee', 'ranged'], 'melee'),
      // Only used by the Resistant type (Across the Stars, p.105): which of this participant's
      // own damage Resistances it passes on to the whole Megaform.
      damageType: makeStrWithChoices(Object.keys(E20.damageTypes), 'blunt'),
      // The magnitude of the effect: Essence/Toughness/Evasion bonus for Core Ability, Core
      // Defenses, and Defender (normally 1 per RAW), feet of movement for Move (normally 10ft
      // added to an existing type, or 45ft for a brand new type), bonus Health for Layered
      // Systems (normally 3, stackable up to 3 times per RAW), bonus melee damage for Assault
      // Weapon (normally 1), or flat Skill bonus for Skill Expertise (normally 1).
      value: makeInt(1),
    };
  }
}
