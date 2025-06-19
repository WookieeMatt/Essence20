import { E20 } from "../../helpers/config.mjs";

import { makeInt, makeStrArray, makeStrArrayWithChoices } from "../generic-makers.mjs";

import { common } from './templates/common.mjs';
import { machine } from './templates/machine.mjs';
import { zordBase } from './templates/zord-base.mjs';

export class MegaformActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...common(),
      ...machine(),
      ...zordBase(),
      subtype: makeStrArrayWithChoices(Object.keys(E20.megaformSubtypes), 'megaformZord'),
      health: makeInt(null),
      zordIds: makeStrArray(),
    };
  }

  prepareBaseData() {
    this.skills.initiative.canBeInitiative = true;
  }
}

