import { makeBool } from "../generic-makers.mjs";

import { character , migrateCharacterData } from './templates/character.mjs';
import { common } from './templates/common.mjs';
import { creature } from './templates/creature.mjs';

export class PowerRangerActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
      canMorph: makeBool(true),
    };
  }

  static migrateData(source) {
    migrateCharacterData(source);
    return super.migrateData(source);
  }

  prepareBaseData() {
    this.movementIsReadOnly = true;
  }
}
