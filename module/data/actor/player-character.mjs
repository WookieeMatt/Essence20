import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeStrWithChoices } from "../generic-makers.mjs";

import { character, migrateCharacterData } from './templates/character.mjs';
import { common } from './templates/common.mjs';
import { creature } from './templates/creature.mjs';

export class PlayerCharacterActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
      canMorph: makeBool(false),
      canSetToughnessBonus: makeBool(false),
      canSpellcast: makeBool(false),
      canTransform: makeBool(false),
      transformerFaction: makeStrWithChoices(Object.keys(E20.transformerFactions), 'autobots'),
    };
  }

  static migrateData(source) {
    migrateCharacterData(source);
    return super.migrateData(source);
  }

  prepareBaseData() {
    super.prepareBaseData();
    this.movementIsReadOnly = true;
  }
}
