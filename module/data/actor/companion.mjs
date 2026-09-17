import { E20 } from "../../helpers/config.mjs";

import { makeStrWithChoices } from "../generic-makers.mjs";

import { character } from './templates/character.mjs';
import { common } from './templates/common.mjs';
import { creature } from './templates/creature.mjs';
import { migrateNonPcStats } from './templates/stat-migration.mjs';

export class CompanionActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
      availability: makeStrWithChoices(Object.keys(E20.availabilities), 'standard'),
      type: makeStrWithChoices(Object.keys(E20.companionTypes), 'pet'),
    };
  }

  static migrateData(source) {
    migrateNonPcStats(source);
    return super.migrateData(source);
  }
}
