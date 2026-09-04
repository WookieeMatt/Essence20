import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

const fields = foundry.data.fields;

export class WeaponEffectItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      classification: new fields.SchemaField({
        skill: makeStrWithChoices([...Object.keys(E20.skills), 'roleSkillDie'], 'athletics'),
        style: makeStrWithChoices(Object.keys(E20.weaponStyles), 'melee'),
      }),
      damageType: makeStrWithChoices(Object.keys(E20.damageTypes), 'blunt'),
      damageValue: makeInt(1),
      // Which of the target's four Defenses (p.168-169) this attack's Skill Test is rolled
      // against.
      defenseType: makeStrWithChoices(Object.keys(E20.defenses), 'toughness'),
      isSpecialized: makeBool(false),
      numHands: makeInt(1),
      numTargets: makeInt(1),
      radius: makeInt(0),
      // Area of Effect shape (GitHub #824) - "burst" is a circle centered on a chosen impact
      // point (e.g. a thrown grenade's "Blast (10ft radius)"); "cone" originates at the
      // attacker's own token and is aimed at a chosen point (e.g. a flamethrower's "Blast (15ft
      // cone)"). Null for an ordinary single/Multiple-Targets attack with no AoE shape at all.
      // Consumed by helpers/aoe-targeting.mjs, keyed on this and the existing radius field above.
      shape: makeStrWithChoices(['burst', 'cone'], null),
      range: new fields.SchemaField({
        min: makeInt(null),
        reachMultiplier: makeInt(null),
        long: makeInt(null),
        value: makeInt(null),
      }),
      shiftDown: makeInt(0),
      totalReach: makeInt(0),
    };
  }

  prepareDerivedData() {
    if (["megaform", "npc", "playerCharacter", "vehicle", "zord"].includes(this.parent.parent?.type)) {
      let reachMultiplier = 1;
      const actorReach = CONFIG.E20.actorReach[this.parent.parent.system.size];
      if (this.range.reachMultiplier > 1) {
        reachMultiplier = this.range.reachMultiplier;
      }

      const totalReach = actorReach * reachMultiplier;
      this.totalReach = totalReach;
    }

    return super.prepareDerivedData;
  }
}
