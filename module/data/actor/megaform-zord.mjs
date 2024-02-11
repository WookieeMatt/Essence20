import {common} from './common';
import {machine} from './machine';
import {zordBase} from './zordBase';

const fields = foundry.data.fields;

class PowerRangerActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...common(),
      ...machine(),
      ...zordBase(),
      canMorph: new fields.BooleanField({initial: false}),
    };
  }
}
