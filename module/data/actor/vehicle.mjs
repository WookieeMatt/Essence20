import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStr } from "../generic-makers.mjs";

import { common } from './templates/common.mjs';
import { machine } from './templates/machine.mjs';
import { migrateNonPcStats } from './templates/stat-migration.mjs';

const fields = foundry.data.fields;

// One boolean per E20.vehicleTraits key - same shape common.mjs's own (private) makeDamageSchema
// already builds for system.immunities/resistances, and the shape the shared TraitSelector app
// (apps/trait-selector.mjs) requires for an ACTOR-owned (as opposed to Item-owned, which is a
// plain chosen-keys array - see item/upgrade.mjs's own traits field) trait field: its Actor branch
// reads/writes `Object.keys(owner.system[field])`, a fixed key set with each toggled independently,
// not an arbitrary array. Not exported from common.mjs since it's a one-off, not (yet) needed by a
// third field.
function makeVehicleTraitsSchema() {
  const schema = {};
  for (const trait of Object.keys(E20.vehicleTraits)) {
    schema[trait] = makeBool(false);
  }

  return new fields.SchemaField(schema);
}

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
      // E20.vehicleTraits (config.mjs) - scoped to Vehicle only, not Zord: RAW is explicit that
      // Zords don't use this Vehicle Trait system the way ordinary vehicles do (they have their
      // own, separate Megaform/Zord Trait system instead - see megaform-trait.mjs).
      traits: makeVehicleTraitsSchema(),
      // Defeat of a Vehicle (GI Joe CRB, p.214-215): set by helpers/vehicle-defeat.mjs once this
      // Vehicle crashes (forced Prone/impassable terrain, or passing its 0-Health Brawn Test).
      // Deliberately a flag read by Essence20Actor#_prepareVehicleData() to zero the DISPLAYED
      // Movement each render (system.movementIsReadOnly, same pattern _prepareMegaformData()
      // already uses) rather than destructively overwriting the real stored Movement values -
      // repairing the Vehicle is just clearing this flag, with nothing to restore.
      crashed: makeBool(false),
    };
  }

  static migrateData(source) {
    migrateNonPcStats(source);
    return super.migrateData(source);
  }
}
