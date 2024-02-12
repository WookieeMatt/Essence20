import { common } from './common';
import { machine } from './machine';

import { makeInt, makeStr } from "../generic-makers.mjs";

const fields = foundry.data.fields;

class VehicleActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...common(),
      ...machine(),
      crew: new fields.SchemaField({
        description: makeStr(''),
        numDrivers: makeInt(1),
        numPassengers: makeInt(0),
      }),
      firepoints: new fields.SchemaField({
        description: makeStr(''),
        value: makeInt(1),
      }),
      threatLevel: makeInt(0),
    };
  }
}
