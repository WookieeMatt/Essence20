import { common } from './common';
import { machine } from './machine';
import { zordBase } from './zordBase';

import { makeInt } from "../generic-makers.mjs";

const fields = foundry.data.fields;

class MegaformZordActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...common(),
      ...machine(),
      ...zordBase(),
      health: makeInt(null),
      zordIds: new fields.ArrayField(new fields.StringField()), // Idt we need this
    };
  }
}
