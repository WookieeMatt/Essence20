import { character } from './character.mjs';
import { common } from './common.mjs';
import { creature } from './creature.mjs';

export class GiJoeActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
    };
  }
}
