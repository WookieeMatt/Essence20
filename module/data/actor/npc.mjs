import { makeBool, makeInt, makeStr } from "../generic-makers.mjs";

import { basedEssences, character, migrateCharacterData } from './templates/character.mjs';
import { migrateCreatureEssences } from '../../mechanics/characters/creature-essences.mjs';
import { common } from './templates/common.mjs';
import { creature } from './templates/creature.mjs';
import { migrateNonPcStats } from './templates/stat-migration.mjs';

export class NpcActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
      allegiancePoints: makeInt(0),
      gainingTheContact: makeStr(''),
      isContact: makeBool(false),
      isNPC: makeBool(true),
      threatLevel: makeInt(0),
      // A typed base under the worked-out score (mechanics/characters/creature-essences.mjs).
      essences: basedEssences(),
    };
  }

  static migrateData(source, options) {
    migrateCharacterData(source);
    migrateNonPcStats(source);
    migrateCreatureEssences(source, options);
    return super.migrateData(source, options);
  }
}
