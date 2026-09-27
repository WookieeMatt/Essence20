import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStrWithChoices } from "../generic-makers.mjs";

import { aoeSchema } from "../aoe-schema.mjs";
import { isExtendedAttackActive } from "../../helpers/extended-attack.mjs";
import { isMassShiftReachActive } from "../../helpers/mass-shift.mjs";
import { isAntlersReachActive } from "../../helpers/antlers.mjs";

import { activation } from './templates/activation.mjs';
import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

const fields = foundry.data.fields;

export class WeaponEffectItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      /* Attacking costs a Standard action, and the weapon effect is what carries that cost
         because the weapon effect is what rolls: a weapon has no roll button anywhere in the
         sheet (see templates/actor/parts/items/weapon/container.hbs, where the d20 sits on the
         effect rows), so a cost on the weapon itself would never be charged. One effect is one
         attack, so this is charged once per attack however many effects a weapon has.

         Unlike the Perks, this default is not the system inventing a cost it can't justify -
         an attack is the Attack action, and the Attack action is a Standard one. All 676 pack
         weapon effects already store `standard` explicitly, so the packs need no rebuild; what
         this default fixes is the effect a GM makes by hand on an actor, which until now was
         born as None and silently cost nothing. Copies already embedded that way carry the old
         value in their source and are moved by migration.mjs. An effect that genuinely is not
         an attack can still be set to None on its own sheet. */
      ...activation('standard'),
      ...itemDescription(),
      classification: new fields.SchemaField({
        skill: makeStrWithChoices([...Object.keys(E20.skills), 'roleSkillDie'], 'athletics'),
        style: makeStrWithChoices(Object.keys(E20.weaponStyles), 'melee'),
      }),
      damageType: makeStrWithChoices(Object.keys(E20.damageTypes), 'blunt'),
      damageValue: makeInt(1),
      // A second damage component dealt by the same hit, for the effects whose printed line is
      // "X <type> and Y <type>" (e.g. a Bowling Ball's 1 Blunt and 1 Stun). A second weaponEffect
      // can't express that - each effect is its own separate attack. Applied alongside the main
      // damage by the same Apply Damage button (chat.mjs#onApplyDamage), scaled by the same
      // Degrees of Success. A null type or a 0 value (the defaults) means there is none.
      secondaryDamage: new fields.SchemaField({
        type: makeStrWithChoices(Object.keys(E20.damageTypes), null),
        value: makeInt(0),
      }),
      // Which of the target's four Defenses (p.168-169) this attack's Skill Test is rolled
      // against.
      defenseType: makeStrWithChoices(Object.keys(E20.defenses), 'toughness'),
      // A Vehicle's own inherent Ram/Flyby attack (GI Joe CRB p.172's "Vehicle Perks, Powers, and
      // Traits" - every vehicle stat block with one names it "Ram" or "Flyby", always carrying
      // the Drive-By weapon trait but with no OTHER shared classification distinguishing either
      // from an ordinary Blunt attack). Sideswipe/Demolition Driver (Factions in Action Vol. 2,
      // p.64, see dice.mjs's own _isSideswipeAttack/_isDemolitionDriverAttack) need to identify
      // these two specific attacks - previously matched by the item's own display NAME, the only
      // field RAW itself distinguishes them by, but that broke the instant anyone renamed or
      // localized the item. An explicit flag set once at content-authoring time is the same fix
      // this project already applies to every other "no real classification field exists"
      // Perk-matching gap (e.g. Puissance/Smash's own "no parent weapon" proxy).
      isRam: makeBool(false),
      isFlyby: makeBool(false),
      isSpecialized: makeBool(false),
      // Accurate/Armor Piercing (Weapon Effects and Traits, PR CRB p.106) - both were, until now,
      // purely cosmetic entries in the parent Weapon item's own `traits` array (a config label
      // with zero mechanical hook anywhere in this codebase). These two fields are the first real
      // mechanical hooks for them, built for "Design your own Attack" (A Jump Through Time,
      // Purple Ranger's Unique Strike/Enhance Strike, p.37-39, see helpers/unique-strike.mjs) -
      // a freshly player-authored weaponEffect can now actually express either trait. Defaulting
      // to 0/false leaves every existing compendium weaponEffect completely unaffected; this pass
      // does NOT retroactively populate them onto the ~28 existing items whose own `traits` array
      // already names "accurate"/"armorPiercing" decoratively - that's its own separate
      // verification pass (each would need its own printed shift amount confirmed against RAW).
      accurateShiftUp: makeInt(0),
      hasArmorPiercing: makeBool(false),
      numHands: makeInt(1),
      numTargets: makeInt(1),
      // Area of Effect shape + radius (GitHub #824), shared with spells and Powers - see
      // module/data/aoe-schema.mjs. Consumed by helpers/aoe-targeting.mjs.
      ...aoeSchema(),
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

      // Extended Attack - see helpers/extended-attack.mjs's own doc comment. Melee only, and
      // doesn't stack with an already-doubled (or better) permanent reachMultiplier.
      if (this.classification?.style == 'melee'
        && (isExtendedAttackActive(this.parent.parent) || isMassShiftReachActive(this.parent.parent))) {
        reachMultiplier = Math.max(reachMultiplier, 2);
      }

      // Antlers - see helpers/antlers.mjs's own doc comment. Unarmed only (no parent weapon Item,
      // the same "no parentId flag" proxy dice.mjs#_getParentWeapon already uses for "unarmed"
      // everywhere else in this codebase), doesn't stack past a flat double.
      const isUnarmed = !this.parent.flags?.essence20?.parentId;
      if (this.classification?.style == 'melee' && isAntlersReachActive(this.parent.parent, isUnarmed)) {
        reachMultiplier = Math.max(reachMultiplier, 2);
      }

      const totalReach = actorReach * reachMultiplier;
      this.totalReach = totalReach;
    }

    return super.prepareDerivedData;
  }
}
