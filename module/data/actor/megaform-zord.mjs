import { makeInt, makeStrArray } from "../generic-makers.mjs";

import { common } from './templates/common.mjs';
import { machine } from './templates/machine.mjs';
import { zordBase } from './templates/zordBase.mjs';

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
