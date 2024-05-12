import { common } from './common';
import { machine } from './machine';
import { zordBase } from './zordBase';

import { makeInt, makeStrArray } from "../generic-makers.mjs";

class MegaformZordActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...common(),
      ...machine(),
      ...zordBase(),
      health: makeInt(null),
      zordIds: makeStrArray(),
    };
  }
}
