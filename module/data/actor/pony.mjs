import { common } from './common';
import { creature } from './creature';
import { character } from './character';

class PonyActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
      canSpellcast: new fields.BooleanField({initial: true}),
    };
  }
}
