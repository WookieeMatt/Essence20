import { makeInt, makeStr } from "../generic-makers.mjs";

import { common } from './templates/common.mjs';
import { machine } from './templates/machine.mjs';

const fields = foundry.data.fields;

export class VehicleActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...common(),
      ...machine(),
      firepoints: new fields.SchemaField({
        description: makeStr(''),
        value: makeInt(1),
      }),
      threatLevel: makeInt(0),
    };
  }

  prepareBaseData() {
    this.skills.initiative.canBeInitiative = true;
  }
}
