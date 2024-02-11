import { common } from './common';
import { machine } from './machine';
import { zordBase } from './zordBase';

const fields = foundry.data.fields;

class PowerRangerActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...common(),
      ...machine(),
      ...zordBase(),
      health: new fields.NumberField({
        initial: null,
        integer: true,
      }),
      zordIds: new fields.ArrayField(new fields.StringField()), // Idt we need this
    };
  }
}
