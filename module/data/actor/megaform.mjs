import { E20 } from "../../helpers/config.mjs";

import { makeNumberArray, makeStrArray, makeStrWithChoices } from "../generic-makers.mjs";

import { common } from './templates/common.mjs';
import { machine } from './templates/machine.mjs';

export class MegaformActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...common(),
      ...machine(),
      subtype: makeStrWithChoices(Object.keys(E20.megaformSubtypes), 'megaformZord'),
      health: makeNumberArray(),
      zordIds: makeStrArray(),
    };
  }
}

