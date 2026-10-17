/**
 * Monster Morph (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 3rd level) - switching the Monster Form on and
 * off is the Perk's own Use rule (3 Personal Power, Large Size, +2 Health bonus; it writes
 * flags.essence20.monsterFormActive). The Toughness bonus and the Skill upshifts are rules on each Path's Role item.
 * This file keeps the reader of that flag. (Grow!, which needs the Monster Form, is its Perk's own Use and Defense rules -
 * rules/conv17-split2.test.js.)
 */
const MONSTER_FORM_ACTIVE_FLAG = 'monsterFormActive';

export function isMonsterFormActive(actor) {
  return !!actor?.getFlag?.('essence20', MONSTER_FORM_ACTIVE_FLAG);
}
