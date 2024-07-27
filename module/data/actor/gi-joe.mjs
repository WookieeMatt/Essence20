import { character, migrateCharacterData } from './templates/character.mjs';
import { common } from './templates/common.mjs';
import { creature } from './templates/creature.mjs';
import { makeBool } from "../generic-makers.mjs";

export class GiJoeActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
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
