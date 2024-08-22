import { makeInt, makeStrArray } from "../generic-makers.mjs";

import { common } from './templates/common.mjs';
import { machine } from './templates/machine.mjs';
import { zordBase } from './templates/zord-base.mjs';

export class MegaformActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...common(),
      ...machine(),
      ...zordBase(),
      health: makeInt(null),
      zordIds: makeStrArray(),
    };
  }

  static migrateMegaformData(source) {
    console.log(source)
    return super.migrateData(source);
  }
}


