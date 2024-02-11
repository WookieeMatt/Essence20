import { character } from './character';
import { common } from './common';
import { creature } from './creature';

import { makeBool } from "../../generic-makers.mjs";

class PonyActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
      canSpellcast: makeBool(true),
    };
  }
}
