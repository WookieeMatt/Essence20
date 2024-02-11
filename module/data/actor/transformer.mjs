import { common } from './common';
import { creature } from './creature';
import { character } from './character';
import { makeBool, makeInt, makeStr } from "../generic-makers.mjs";

const fields = foundry.data.fields;

class TransformerActorData extends foundry.abstract.DataModel {
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
