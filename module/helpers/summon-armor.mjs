/**
 * Summon Armor (MLP CRB, Superior Aid spell, p.138) / Summon Shield (MLP CRB, Elementary Aid
 * spell, p.136): "You encase a creature in a magical form fitting, protective shell... Target
 * creature gains a +2 bonus to Toughness and Evasion for the duration of the spell."
 *
 * RE-CATEGORIZED 2026-09-15 - both were previously bucketed under the "Item-grant / equipment-
 * mutation mechanism" gap on the assumption their names meant a real armor/shield Item needed to
 * be created. Direct RAW verification found neither one actually grants a physical item at all -
 * "encase... in a magical form fitting, protective shell" is a plain +2 Toughness/+2 Evasion buff,
 * textually identical between the two spells (only their own Tier/cost/duration differ). Same
 * "set a flag on whichever token is currently targeted (or the caster themselves), left set until
 * manually cleared" idiom as Fluttery Wings/Lightning Speed's own successful-cast grants - a
 * "scene"/"2 rounds" duration this system can't literally track gets the same approximation every
 * other timed grant in this project already accepts. Unlike Phantom Suite's own Evasion bonus
 * (self-toggled, cleared by a hit), there's no natural end-trigger to auto-clear this on, so it's
 * left as a live, non-consumed read - the same shape Stand By Me's own "for as long as an ally
 * stays adjacent" Defense bonus already establishes for an externally-granted buff.
 */
const SUMMON_ARMOR_FLAG = 'summonArmorActive';
const SUMMON_ARMOR_BONUS = 2;

export function isSummonArmorActive(actor) {
  return !!actor.getFlag?.('essence20', SUMMON_ARMOR_FLAG);
}

export async function applySummonArmor(targetActor) {
  await targetActor.setFlag('essence20', SUMMON_ARMOR_FLAG, true);
}

export function getSummonArmorDefenseBonus(actor, defenseType) {
  if (!isSummonArmorActive(actor)) {
    return 0;
  }

  return defenseType == 'toughness' || defenseType == 'evasion' ? SUMMON_ARMOR_BONUS : 0;
}
