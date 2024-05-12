import { E20 } from "../../../helpers/config.mjs";
import { character } from './character';
import { common } from './common';
import { creature } from './creature';

import { makeInt } from "../generic-makers.mjs";

const fields = foundry.data.fields;

function makeDefensesFields(init) {
  return new fields.SchemaField({
    value: makeInt(init),
  });
}

class CompanionActorData extends foundry.abstract.DataModel {
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
