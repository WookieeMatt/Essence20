import { makeInt } from "../generic-makers.mjs";

import { character } from './character.mjs';
import { common } from './common.mjs';
import { creature } from './creature.mjs';

const fields = foundry.data.fields;

function makeDefensesFields(init) {
  return new fields.SchemaField({
    value: makeInt(init),
  });
}

export class NpcActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
      defenses: new fields.SchemaField({
        toughness: makeDefensesFields(10),
        evasion: makeDefensesFields(10),
        willpower: makeDefensesFields(null),
        cleverness: makeDefensesFields(null),
      }),
      threatLevel: makeInt(0),
    };
  }
}
