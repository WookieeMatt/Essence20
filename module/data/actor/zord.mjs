import { makeBool, makeStr } from "../generic-makers.mjs";

import { common } from './templates/common.mjs';
import { machine } from './templates/machine.mjs';
import { zordBase } from './templates/zord-base.mjs';

export class ZordActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...common(),
      ...machine(),
      ...zordBase(),
      isCombiner: makeBool(true),
      prerequisite: makeStr(''),
      ranger: makeStr(''),
    };
  }

  prepareBaseData() {
    this.conditioning = 3;
    this.defenses.evasion.value = 14;
    this.defenses.toughness.value = 16;
    this.essences.speed.value = 4;
    this.essences.strength.value = 6;
    this.health.max = 6;
    this.initiative.shift = "d6";
    this.movement.ground.total = 40;
    this.size = "huge";
    this.skills.brawn.shift = "d6";
    this.skills.driving.shift = "d2";
  }
}
