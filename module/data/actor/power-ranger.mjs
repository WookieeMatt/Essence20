import { makeBool } from "../../generic-makers.mjs";

import { character } from './character.mjs';
import { common } from './common.mjs';
import { creature } from './creature.mjs';

export class PowerRangerActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
      canMorph: makeBool(true),
    };
  }
}
