import { common } from './common';
import { machine } from './machine';
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
      ...common(),
      ...machine(),
      crew: new fields.SchemaField({
        description: new fields.StringField({initial: ''}),
        numDrivers: makeInt(1),
        numPassengers: makeInt(0),
      }),
      firepoints: new fields.SchemaField({
        description: new fields.StringField({initial: ''}),
        value: makeInt(1),
      }),
      threatLevel: makeInt(0),
    };
  }
}
