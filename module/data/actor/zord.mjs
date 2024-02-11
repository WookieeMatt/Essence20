import { common } from './common';
import { machine } from './machine';
import { zordBase } from './zordBase';

const fields = foundry.data.fields;

class ZordActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...common(),
      ...machine(),
      ...zordBase(),
      isCombiner: new fields.BooleanField({initial: true}),
      prerequisite: new fields.StringField({initial: ''}),
      ranger: new fields.StringField({initial: ''}),
    };
  }
}
