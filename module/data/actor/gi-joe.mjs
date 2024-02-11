import { common } from './common';
import { creature } from './creature';
import { character } from './character';

class GiJoeActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
    };
  }
}
