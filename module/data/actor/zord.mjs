import { makeBool, makeStr } from "../generic-makers.mjs";

import { common } from './common.mjs';
import { machine } from './machine.mjs';
import { zordBase } from './zord-base.mjs';

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
