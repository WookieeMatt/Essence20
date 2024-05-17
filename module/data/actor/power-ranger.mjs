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
}
