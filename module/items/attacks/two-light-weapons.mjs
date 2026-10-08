import { registerApplyDialog, registerDialogToggles } from "../../mechanics/item-hooks.mjs";
import { parentOf } from "../shared/gm-relayed-item-writes.mjs";
import { T } from "../shared/item-lang.mjs";
import { num } from "../shared/numbers.mjs";

/**
 * Attacking with two light weapons: "the usual ↓1 on one Attack and ↓2 on the other" (Intercontinental
 * Adventures p.12-13, Two-Handed Assault) - dice.mjs's Two-Handed Assault checkbox gives its ↑1 on
 * top of this. A Roll Options Dialog select on a light or sidearm weapon's attack.
 */
export function isLightWeaponAttack(item) {
  return item?.type == 'weaponEffect' && ['light', 'sidearm'].includes(parentOf(item)?.system?.classification?.size);
}

registerDialogToggles((actor, ctx) => (isLightWeaponAttack(ctx?.item) ? [{
  name: 'o2TwoWeapons', label: T('O2TwoWeapons'), type: 'select', value: 'none',
  options: [
    { value: 'none', label: T('O2TwoWeaponsNone') },
    { value: 'first', label: T('O2TwoWeaponsFirst') },
    { value: 'second', label: T('O2TwoWeaponsSecond') },
  ],
}] : []));

registerApplyDialog((actor, options) => {
  const pick = options.ext?.o2TwoWeapons;
  if (pick == 'first') {
    options.shiftDown = num(options.shiftDown) + 1;
  } else if (pick == 'second') {
    options.shiftDown = num(options.shiftDown) + 2;
  }
});
