import { character } from './character';
import { common } from './common';
import { creature } from './creature';

class GiJoeActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
    };
  }
}
