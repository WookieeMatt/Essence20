import { makeBool, makeInt, makeStr } from "../generic-makers.mjs";

import { character, migrateCharacterData } from './templates/character.mjs';
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
    };
  }

  static migrateData(source) {
    migrateCharacterData(source);
    migrateNonPcStats(source);
    return super.migrateData(source);
  }
}
