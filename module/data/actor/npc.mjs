import { makeBool, makeInt, makeStr } from "../generic-makers.mjs";

import { character, migrateCharacterData } from './templates/character.mjs';
import { common } from './templates/common.mjs';
import { creature } from './templates/creature.mjs';

const fields = foundry.data.fields;

function makeDefensesFields(init) {
  return new fields.SchemaField({
    value: makeInt(init),
  });
}

export class NpcActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
      allegiancePoints: makeInt(0),
      defenses: new fields.SchemaField({
        toughness: makeDefensesFields(10),
        evasion: makeDefensesFields(10),
        willpower: makeDefensesFields(null),
        cleverness: makeDefensesFields(null),
      }),
      gainingTheContact: makeStr(''),
      isContact: makeBool(false),
      isNPC: makeBool(true),
      threatLevel: makeInt(0),
    };
  }

  static migrateData(source) {
    migrateCharacterData(source);
    return super.migrateData(source);
  }
}
