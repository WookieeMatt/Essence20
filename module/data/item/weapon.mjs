import { E20 } from "../../helpers/config.mjs";

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
      requirements: new fields.SchemaField({
        custom: makeStr(null),
        skill: makeStrWithChoices(Object.keys(E20.skills), null),
        shift: makeStrWithChoices(E20.weaponRequirementShifts, null),
      }),
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
      // Defend (Across the Stars, Weapon Traits, p.79): "wielders add the listed bonus to the
      // user's Evasion and Toughness Defenses against melee attacks." Same "magnitude field next
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
