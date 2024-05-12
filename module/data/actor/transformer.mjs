import { makeBool, makeInt, makeStr } from "../generic-makers.mjs";

import { character } from './templates/character.mjs';
import { common } from './templates/common.mjs';
import { creature } from './templates/creature.mjs';

export class TransformerActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
      canTransform: makeBool(true),
      externalHardpoints: makeInt(2),
      internalHarpoints: makeInt(2),
      transformerFaction: makeStr('autobots'),
    };
  }
}
