import { character } from './templates/character.mjs';
import { common } from './templates/common.mjs';
import { creature } from './templates/creature.mjs';

export class GiJoeActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
    };
  }

  prepareBaseData() {
    this.movementIsReadOnly = true;
  }
}
