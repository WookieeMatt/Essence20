import { E20 } from "../../helpers/config.mjs";

import {
  makeBool,
  makeInt,
  makeStrArrayWithChoices,
  makeStrWithChoices,
} from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';
import { parentItem } from './templates/parent-item.mjs';

export class ArmorItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      availability: makeStrWithChoices(Object.keys(E20.availabilities), 'standard'),
      bonusEvasion: makeInt(0),
      bonusToughness: makeInt(0),
      // Bulwark (Across the Stars, Armor Traits, p.82): "This armor grants the wearer additional
      // Health while worn. The amount of Health is listed in parentheses." Read by
      // documents/actor.mjs#_prepareHealth. The book's own "removing the armor leaves the wearer
      // with a minimum of 1 Health if they had taken damage" clause isn't modelled - this system
      // has no general "clamp current Health when max Health drops" pass to hook it onto (see that
      // method's own health.value handling), the same design gap every other Health-changing
      // source here already lives with.
      bulwarkHealthBonus: makeInt(0),
      classification: makeStrWithChoices(Object.keys(E20.armorClassifications), 'light'),
      // Enhance Skill (Across the Stars, Armor Traits, p.85): "Integrated technology or other
      // enhancements in this armor grant ↑1 to the Skill listed in the parentheses." Which skill
      // varies per armor, so it needs its own field rather than a bare trait check - null (no
      // skill chosen yet) grants nothing, read by dice.mjs's own rolledSkill check.
      enhanceSkillTarget: makeStrWithChoices(Object.keys(E20.skills), null),
      equipped: makeBool(false),
      // Power Armor (Power Rangers CRB Table 8-5, p.118, e.g. Mighty Morphin Armor): the armor
      // TYPE a Ranger's Morphed form takes, not a separate suit worn alongside it - "it only
      // exists while Morphed" (USER RULING, 2026-09-24). documents/actor.mjs#_prepareDefenses
      // already excludes ALL equipped armor while Morphed (adds system.defenses.<x>.morphed
      // instead - the Morphed armor-type picker's own value), so this flag only matters for the
      // NOT-Morphed case: without it, marking one of these items "equipped" while not Morphed
      // would wrongly stack its Toughness/Evasion bonus on top of ordinary defenses, which RAW
      // never intends since the suit isn't real outside the Morphed state.
      isPowerArmor: makeBool(false),
      traits: makeStrArrayWithChoices(Object.keys(E20.armorTraits)),
      totalBonusEvasion: makeInt(0),
      totalBonusToughness: makeInt(0),
      upgradeTraits: makeStrArrayWithChoices(Object.keys(E20.armorTraits)),
    };
  }
}
