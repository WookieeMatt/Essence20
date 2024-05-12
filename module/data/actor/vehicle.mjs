import { makeInt, makeStr } from "../generic-makers.mjs";

import { common } from './templates/common.mjs';
import { machine } from './templates/machine.mjs';

const fields = foundry.data.fields;

export class VehicleActorData extends foundry.abstract.DataModel {
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
