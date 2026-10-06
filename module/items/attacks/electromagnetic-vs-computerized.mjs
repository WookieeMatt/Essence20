import { registerRollSources } from "../../mechanics/item-hooks.mjs";
import { isRobotic } from "../../mechanics/characters/creature-tags.mjs";
import { CC, parentWeapon } from "../shared/pay-power-and-actors-in-play.mjs";
import { T } from "../shared/item-lang.mjs";
import { itemsOf, sourceOf } from "../shared/item-lookups.mjs";

/**
 * Cobra Codex: Electromagnetic attacks against computerized gear. (The Deflecting Weapon upgrades are
 * items/defenses/deflecting-weapon.mjs. Shield Fighter, Onslaught, Poison Resistance, Dielectric, Insulator and
 * the Disenfranchised Hang-Up's Willpower check are item rules.)
 */
export const O1_CC = {
  cyberneticPart: CC('wCL3rJOEDZVHVg6g'),
  enhancedPart: CC('eT4g9EfrFtvjMqWu'),
  optimizedPart: CC('zGsTAngJ2HRdKPkz'),
};

/** An upgrade counts while it is loose on the actor or on something equipped. */
export function isWorn(upgrade) {
  const parentId = upgrade?.flags?.essence20?.parentId;
  return !parentId || !!upgrade.parent?.items?.get?.(parentId)?.system?.equipped;
}

/**
 * GI Joe CRB p.207: Electromagnetic effects "are ↑3 against computers, computerized vehicles,
 * characters with computerized equipment, and robots, but ↓3 against all other targets." dice.mjs
 * reads only the Computerized vehicle trait, so a character in computerized gear or with cybernetic
 * parts (or a robot) was getting the ↓3.
 */
export function hasComputerizedGear(actor) {
  if (isRobotic(actor)) {
    return true;
  }

  return itemsOf(actor).some(item => {
    if ([O1_CC.cyberneticPart, O1_CC.enhancedPart, O1_CC.optimizedPart].includes(sourceOf(item))) {
      return true;
    }

    const traits = item.system?.traits ?? [];
    if (!traits.includes?.('computerized')) {
      return false;
    }

    return item.type == 'upgrade' ? isWorn(item) : (item.system?.equipped ?? true);
  });
}

// Dielectric / Insulator (the ↑3 cut to ↑1 / ↑2) are incoming item rules on their pack items.
function isElectromagneticAttack(actor, item) {
  return item?.type == 'weaponEffect'
    && (item.system?.damageType == 'emp' || !!parentWeapon(actor, item)?.system?.traits?.includes?.('electromagnetic'));
}

registerRollSources((actor, target, ctx) => {
  const item = ctx?.item;
  if (!target || !isElectromagneticAttack(actor, item)) {
    return null;
  }

  const label = game.i18n.localize('E20.DamageEmp');
  const sources = [];
  if (!target.system?.traits?.computerized && hasComputerizedGear(target)) {
    // Undo dice.mjs's "all other targets" ↓3, then the real ↑.
    sources.push({ id: 'o1EmNotOther', label: T('O1EmComputerizedGear', { label }), shiftUp: 3 });
    sources.push({ id: 'o1EmVsGear', label: T('O1EmVsGear', { label }), shiftUp: 3 });
  }

  return { sources };
});
