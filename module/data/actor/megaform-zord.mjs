import { makeInt, makeStrArray } from "../generic-makers.mjs";

import { common } from './common.mjs';
import { machine } from './machine.mjs';
import { zordBase } from './zordBase.mjs';

export class MegaformZordActorData extends foundry.abstract.DataModel {
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
