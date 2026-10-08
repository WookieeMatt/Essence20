import { markOf } from "../../rules/predicate.mjs";
/**
 * Summon Armor (MLP CRB, Superior Aid spell, p.138) / Summon Shield (MLP CRB, Elementary Aid
 * spell, p.136): a magical shell around a creature, +2 Toughness and Evasion for the spell's duration.
 *
 * RE-CATEGORIZED 2026-09-15 - both were previously bucketed under the "Item-grant / equipment-
 * mutation mechanism" gap on the assumption their names meant a real armor/shield Item needed to
 * be created. Direct RAW verification found neither one actually grants a physical item at all -
 * the magical shell is a plain +2 Toughness/+2 Evasion buff,
 * textually identical between the two spells (only their own Tier/cost/duration differ). Same
 * flag-the-targeted-token-(or-caster)-until-cleared idiom as Fluttery Wings/Lightning Speed's own successful-cast grants - a
 * "scene"/"2 rounds" duration this system can't literally track gets the same approximation every
 * other timed grant in this project already accepts. Unlike Phantom Suite's own Evasion bonus
 * (self-toggled, cleared by a hit), there's no natural end-trigger to auto-clear this on, so it's
 * left as a live, non-consumed read - the same shape Stand By Me's own "for as long as an ally
 * stays adjacent" Defense bonus already establishes for an externally-granted buff.
 */
// The spells' own afterRoll Trigger rules mark the target summonArmor - Summon Armor for the scene, Summon Shield through the
// end of the next round in a running combat (the scene out of one).
const SUMMON_ARMOR_MARK = 'summonArmor';
const SUMMON_ARMOR_BONUS = 2;

export function isSummonArmorActive(actor) {
  return markOf(actor, SUMMON_ARMOR_MARK);
}

export function getSummonArmorDefenseBonus(actor, defenseType) {
  if (!isSummonArmorActive(actor)) {
    return 0;
  }

  return defenseType == 'toughness' || defenseType == 'evasion' ? SUMMON_ARMOR_BONUS : 0;
}
