import { common } from './common';
import { creature } from './creature';
import { character } from './character';
import { makeBool } from "../../generic-makers.mjs";

class PowerRangerActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
      canMorph: makeBool(false),
    };
  }
}
