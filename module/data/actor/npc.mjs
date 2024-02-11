import { character } from './character';
import { common } from './common';
import { creature } from './creature';

import { makeInt } from "../generic-makers.mjs";

const fields = foundry.data.fields;

function makeDefensesFields(init) {
  return new fields.SchemaField({
    value: new fields.NumberField({
      initial: init,
      integer: true,
    }),
  });
}

class NpcActorData extends foundry.abstract.DataModel {
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
