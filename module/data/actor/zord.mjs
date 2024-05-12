import { makeBool, makeStr } from "../generic-makers.mjs";

import { common } from './templates/common.mjs';
import { machine } from './templates/machine.mjs';
import { zordBase } from './templates/zord-base.mjs';

export class ZordActorData extends foundry.abstract.DataModel {
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
}
