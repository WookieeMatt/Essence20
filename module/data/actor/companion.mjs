import { E20 } from "../../util/config.mjs";

import { makeStrWithChoices } from "../generic-makers.mjs";

import { basedEssences, character, migrateCharacterData } from './templates/character.mjs';
import { migrateCreatureEssences } from '../../mechanics/characters/creature-essences.mjs';
import { common } from './templates/common.mjs';
import { creature } from './templates/creature.mjs';
import { migrateNonPcStats } from './templates/stat-migration.mjs';

export class CompanionActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
      availability: makeStrWithChoices(Object.keys(E20.availabilities), 'standard'),
      type: makeStrWithChoices(Object.keys(E20.companionTypes), 'pet'),
      // A typed base under the worked-out score (mechanics/characters/creature-essences.mjs).
      essences: basedEssences(),
    };
  }

  static migrateData(source, options) {
    // Old flat-number Essences become {max, value} first (as for NPCs), then take their base.
    migrateCharacterData(source);
    migrateNonPcStats(source);
    migrateCreatureEssences(source, options);
    return super.migrateData(source, options);
  }
}
