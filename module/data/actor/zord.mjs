import { makeBool, makeStr } from "../generic-makers.mjs";

import { common } from './templates/common.mjs';
import { machine } from './templates/machine.mjs';
import { migrateNonPcStats } from './templates/stat-migration.mjs';
import { zordBase } from './templates/zord-base.mjs';

export class ZordActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...common(),
      ...machine(),
      ...zordBase(),
      isCombiner: makeBool(true),
      prerequisite: makeStr(''),
      ranger: makeStr(''),
    };
  }

  static migrateData(source) {
    migrateNonPcStats(source);
    return super.migrateData(source);
  }
}
