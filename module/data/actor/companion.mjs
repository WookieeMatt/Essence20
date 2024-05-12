import { E20 } from "../../../helpers/config.mjs";

import { makeInt } from "../generic-makers.mjs";

import { character } from './templates/character.mjs';
import { common } from './templates/common.mjs';
import { creature } from './templates/creature.mjs';

const fields = foundry.data.fields;

function makeDefensesFields(init) {
  return new fields.SchemaField({
    value: makeInt(init),
  });
}

export class CompanionActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
      availability: makeStrWithChoices('standard', E20.availabilities),
      defenses: new fields.SchemaField({
        toughness: makeDefensesFields(10),
        evasion: makeDefensesFields(10),
        willpower: makeDefensesFields(null),
        cleverness: makeDefensesFields(null),
      }),
      type: makeStrWithChoices('pet', E20.companionTypes),
    };
  }
}
