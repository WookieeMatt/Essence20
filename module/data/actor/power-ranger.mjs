import { makeBool } from "../generic-makers.mjs";

import { character } from './templates/character.mjs';
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
    if (typeof source.essences.strength == 'number') {
      console.log(source)
      source.essences.strength.max = source.essences.strength;
      source.essences.strength.value = source.essences.strength;
      source.essences.speed.max = source.essences.speed;
      source.essences.speed.value = source.essences.speed;
      source.essences.smarts.max = source.essences.smarts;
      source.essences.smarts.value = source.essences.smarts;
      source.essences.social.max = source.essences.social;
      source.essences.social.value = source.essences.social;
    }

    return super.migrateData(source);
  }

  prepareBaseData() {
    this.movementIsReadOnly = true;
  }
}
