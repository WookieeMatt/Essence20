import { common } from './common';
import { creature } from './creature';
import { character } from './character';

const fields = foundry.data.fields;

export function makeDefensesFields(init) {
  return new fields.SchemaField({
    value: new fields.NumberField({
      initial: init,
      integer: true,
    }),
  });
}

class CompanionActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
      availability: new fields.StringField({initial: 'standard'}),
      defenses: new fields.SchemaField({
        toughness: makeDefensesFields(false, 10),
        evasion: makeDefensesFields(false, 10),
        willpower: makeDefensesFields(true, null),
        cleverness: makeDefensesFields(true, null),
      }),
      type: new fields.StringField({initial: 'pet'}),
    };
  }
}
