import {common} from './common';
import {creature} from './creature';
import {character} from './character';
import { makeInt } from "../generic-makers.mjs";

const fields = foundry.data.fields;

export function makeDefensesFields(init) {
  return new fields.SchemaField({
    value: new fields.NumberField({
      initial: init,
      integer: true,
    }),
  });
}

class PowerRangerActorData extends foundry.abstract.DataModel {
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
