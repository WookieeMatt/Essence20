import { companionRollSources } from "../../mechanics/companions/companions.mjs";
import { commandDefenseBonus, commandSources } from "../../mechanics/actions/commands.mjs";
import { bondDamageBonus, bondRollSources } from "../../mechanics/companions/bonded-partners.mjs";

/**
 * Everything the companion, command, bond and team Perks add to a roll, gathered in one place so
 * dice.mjs and mechanics/combat/target-riders.mjs each call one function:
 * - socialRollSources   ↑/↓/Edge/Snag sources, listed in the Roll Options Dialog.
 * - socialDefenseAdjust the defender's Defense when attacked.
 * (Synaptic Linkage's once-a-scene Edge, About Twenty-Percent Cooler and Leave It To Me are rules on their Perks.)
 * - socialDamageBonus   Targetmaster's +1.
 */

/**
 * @param {Actor} actor   The roller.
 * @param {Actor|null} target
 * @param {Object} ctx   {item, rolledSkill, isAttack, isShove, weaponId}
 * @returns {{sources: Array<Object>, consumes: Array<Object>}}
 */
export function socialRollSources(actor, target, ctx = {}) {
  const sources = [];
  const consumes = [];
  const { item, rolledSkill, isAttack } = ctx;
  const weaponId = item?.flags?.essence20?.parentId ?? null;
  const isRanged = isAttack && item?.system?.classification?.style && item.system.classification.style != 'melee';
  const add = source => sources.push({ ...source, id: `social-${source.id}` });

  companionRollSources(actor, target, { rolledSkill, isAttack }).forEach(add);

  bondRollSources(actor, target, { rolledSkill, isAttack, weaponId }).forEach(add);
  commandSources(actor, { rolledSkill, isAttack, isRanged }).forEach(add);
  // (In The Right Hands' ↑1 and Handheld Shield Snag are rules its rightHands mark carries.)

  // Let's Bring 'Em Together!'s combined attack: "an additional ↑2 to hit".
  const bonus = Number(item?.flags?.essence20?.bonusShiftUp) || 0;
  if (bonus) {
    add({ id: 'bonusShift', label: item.name, shiftUp: bonus, shiftDown: 0, edge: false, snag: false });
  }

  return { sources, consumes };
}

/**
 * @param {Actor} attacker
 * @param {Actor} defender
 * @param {String} defense
 * @returns {Number}
 */
export function socialDefenseAdjust(attacker, defender, defense) {
  // (Shield Companion is a Defense rule with scope owner on the Mini-Con's Perk.)
  // (Hit Someone Your Own Size!'s Toughness swap is a Defense rule on the Perk.)
  return commandDefenseBonus(defender, defense, attacker);
}

export function socialDamageBonus(actor, weaponId) {
  return bondDamageBonus(actor, weaponId);
}
