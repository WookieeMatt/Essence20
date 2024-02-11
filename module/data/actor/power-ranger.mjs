import { common } from './common';
import { creature } from './creature';
import { character } from './character';

const fields = foundry.data.fields;

class PowerRangerActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
      canMorph: new fields.BooleanField({initial: false}),
    };
  }
}
