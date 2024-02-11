import { character } from './character';
import { common } from './common';
import { creature } from './creature';

import { makeStr, makeInt } from "../generic-makers.mjs";

const fields = foundry.data.fields;

function makeDefensesFields(init) {
  return new fields.SchemaField({
    value: makeInt(init)
  });
}

class CompanionActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
      availability: makeStr('standard'),
      defenses: new fields.SchemaField({
        toughness: makeDefensesFields(false, 10),
        evasion: makeDefensesFields(false, 10),
        willpower: makeDefensesFields(true, null),
        cleverness: makeDefensesFields(true, null),
      }),
      type: makeStr('pet'),
    };
  }
}
