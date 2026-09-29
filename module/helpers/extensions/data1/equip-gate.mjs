/**
 * Worn-only armor Active Effects.
 *
 * Armor's benefits are the armor being worn - Antiques Pelt (Welcome to Night Vale Citizens' Guide,
 * Special Armor, p.69) grants its ↑1 Intimidation/Might and ↓1 Animal Handling/Persuasion as part of
 * the same "Benefit" line as its +2 Toughness, and that Toughness already only counts while equipped
 * (documents/actor.mjs#_prepareDefenses reads equipped armor only). Its skill-shift Active Effects,
 * though, transfer from the Item regardless, so an unequipped pelt in a backpack still shifted
 * rolls. This gate suppresses a transferred effect whose Item is armor that isn't equipped.
 *
 * Power Armor (armor.mjs#isPowerArmor) is left alone: it IS the Morphed form and is never "equipped"
 * in the ordinary sense (documents/actor.mjs skips it outright).
 *
 * Wired into data/effect.mjs#isSuppressed by the data1 patch spec, next to the whileMorphed and
 * environment gates. Returns `undefined` (not false) when it has nothing to say, the same contract
 * as helpers/morph-gated-effects.mjs.
 * @param {Object} effectData   The effect's own type data (effect.system), with its `parent`.
 * @returns {Boolean|undefined}
 */
export function isSuppressedWhileUnequipped(effectData) {
  const effect = effectData?.parent;
  const item = effect?.parent;
  if (!item || item.documentName != 'Item' || item.type != 'armor' || effect.transfer === false) {
    return undefined;
  }

  if (item.system?.isPowerArmor) {
    return undefined;
  }

  return item.system?.equipped === false ? true : undefined;
}
