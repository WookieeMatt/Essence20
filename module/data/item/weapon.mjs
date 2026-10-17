import { E20 } from "../../util/config.mjs";

import {
  makeBool,
  makeInt,
  makeStr,
  makeStrArrayWithChoices,
  makeStrWithChoices,
} from "../generic-makers.mjs";

import { activation } from './templates/activation.mjs';
import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';
import { parentItem } from './templates/parent-item.mjs';

const fields = foundry.data.fields;

export class WeaponItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...activation(),
      ...itemDescription(),
      ...parentItem(),
      availability: makeStrWithChoices(Object.keys(E20.availabilities), 'standard'),
      classification: new fields.SchemaField({
        size: makeStrWithChoices(Object.keys(E20.weaponSizes), 'integrated'),
      }),
      // An Element weapon's element is picked when it is issued for a mission (GI Joe CRB p.207). A damage type key of items/attacks/weapon-upgrades.mjs#ELEMENTS;
      // an effect printed as "Element" damage deals it (weapon-upgrades.mjs#applyToEffect).
      elementChoice: makeStrWithChoices(['acid', 'cold', 'electric', 'emp', 'fire', 'laser', 'sonic'], null),
      equipped: makeBool(true),
      hands: makeInt(null),
      hardpoint: new fields.SchemaField({
        type: makeStrWithChoices(Object.keys(E20.hardpointTypes), 'external'),
        reinforced: makeBool(false),
        altModeVisibility: makeStrWithChoices(Object.keys(E20.altModeVisibilities), 'obvious'),
      }),
      isPoison: makeBool(false),
      poisonType: makeStrWithChoices(Object.keys(E20.poisonTypes)),
      poisonApplication: new fields.SchemaField({
        contact: makeBool (false),
        ingested: makeBool (false),
        inhaled: makeBool (false),
      }),
      // "Requirements: Bot Mode only" / "Alt Mode only" (Transformers): the Mode a Cybertronian must be in to attack with
      // it. Separate from the Hardpoint, which is where the weapon sits, not when it can be used.
      modeRequirement: makeStrWithChoices(Object.keys(E20.weaponModeRequirements), null),
      requirements: new fields.SchemaField({
        custom: makeStr(null),
        skill: makeStrWithChoices(Object.keys(E20.skills), null),
        shift: makeStrWithChoices(E20.weaponRequirementShifts, null),
      }),
      // Deprecated 2026-10-07: no longer worked out (an upgrade's Aim bonus is its AimBonus rule); remove from the
      // data model in 6.1.
      totalAimShiftBonus: makeInt(0),
      traits: makeStrArrayWithChoices(Object.keys(E20.weaponTraits)),
      // Accurate/Inaccurate (dice.mjs's own _getAutomaticCombatModifiers) default to a flat ↑1/↓1,
      // which is right for most weapons carrying either trait - but not all: Cannonade/Catapult
      // (A Jump Through Time, p.?) print Inaccurate (↓2), and the Transdagger Star Formation
      // (Across the Stars) prints Inaccurate (↓3). Rather than a second trait-array entry per
      // magnitude (which E20.weaponTraits has no room for), the trait stays a plain membership
      // check and this carries how many points it's actually worth - 1 leaves every existing
      // compendium weapon's behavior unchanged.
      accurateMagnitude: makeInt(1),
      inaccurateMagnitude: makeInt(1),
      // Defend (Across the Stars, Weapon Traits, p.79): the wielder adds the trait's number to Evasion
      // and Toughness against melee attacks. Same "magnitude field next
      // to a plain membership check" shape as accurateMagnitude/inaccurateMagnitude above - every
      // printed Defend weapon found so far is (1), so that's the default. defendRangedMagnitude is
      // null (grants nothing vs. ranged) unless a weapon's own printed value widens the trait to
      // cover ranged attacks too, e.g. the Zeo Power Disc/Shield's "(2; 1 vs. Ranged Attacks)".
      defendMagnitude: makeInt(1),
      defendRangedMagnitude: makeInt(null),
      // Consumable (GI Joe CRB, Weapon Effects and Traits, p.147): "Using this weapon destroys it,
      // even if it misses its target." Same one-potion-can-hold-several shape as
      // magic-bauble.mjs's own quantity field (documents/item.mjs's magic bauble consumption path)
      // - a holder can carry more than one of the same Consumable weapon, and only the last one
      // firing actually deletes the Item.
      quantity: makeInt(1),
      // Ongoing/Poison/Toxin (Cobra Codex, New Weapon Effects and Traits, p.93-94) - see
      // mechanics/combat/ongoing-effects.mjs's own doc comment. "For the listed amount of time" - RAW's own
      // printed NPC stat blocks (e.g. Cobra Codex's Cesspool) show this as "Ongoing (2 rounds)"/
      // "Ongoing (3 rounds)" per weapon, so this is a magnitude field next to the plain trait
      // membership check, the same shape as defendMagnitude/accurateMagnitude above. Defaulting to
      // 1 round is a placeholder for whichever compendium item doesn't have its own printed value
      // set explicitly yet - see codeneeds_packs.json for the specific items this pass found a
      // real number for.
      ongoingDuration: makeInt(1),
      // Fanning (X) (A Jump Through Time, New Weapon Traits, p.74) - the X, how many Attacks one
      // Fanning volley may fire; see items/attacks/fanning.mjs. Same magnitude-next-to-the-trait shape
      // as ongoingDuration above. Null (no printed X) is treated as 1 there.
      fanningMagnitude: makeInt(null),
      transformerMode : makeStrWithChoices(E20.transformerModes, 'modeBotMode'),
      upgradeTraits: makeStrArrayWithChoices(Object.keys(E20.weaponTraits)),
      usesPerScene: makeInt(null),
    };
  }

  /**
   * Seeds the Hardpoint sub-schema (TF CRB p.114) from the legacy flat transformerMode enum
   * for weapons authored before Hardpoints existed. Bot Mode -> held in an External Hardpoint;
   * Alt Mode / Any Mode -> built into an Integrated Hardpoint (hidden vs obvious in Alt Mode
   * respectively). Runs on every load for un-migrated worlds and compendium items; the world
   * migration (migration.mjs) writes the same mapping through to the database.
   * @param {Object} source The candidate source data for the WeaponItemData model.
   * @returns {Object} The migrated source data.
   */
  static migrateData(source) {
    if (source.transformerMode && !source.hardpoint?.type) {
      const legacyModeToHardpoint = {
        modeBotMode: { type: 'external' },
        modeAltMode: { type: 'integrated', altModeVisibility: 'hidden' },
        modeAny: { type: 'integrated', altModeVisibility: 'obvious' },
      };
      const mapped = legacyModeToHardpoint[source.transformerMode];
      if (mapped) {
        source.hardpoint = { ...(source.hardpoint ?? {}), ...mapped };
      }
    }

    return super.migrateData(source);
  }
}
