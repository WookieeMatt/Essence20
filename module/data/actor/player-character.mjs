import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStrWithChoices } from "../generic-makers.mjs";

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
      externalHardpoints: makeInt(2),
      internalHarpoints: makeInt(2),
      transformerFaction: makeStrWithChoices(Object.keys(E20.transformerFactions), 'autobots'),
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
