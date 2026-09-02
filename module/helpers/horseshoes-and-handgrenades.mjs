import { actorHasPerk } from "./perks.mjs";
import { applyDamage } from "./combat.mjs";

/**
 * Horseshoes and Handgrenades (Artillery Focus, 18th level, p.82): "when you use an explosive
 * weapon, everyone in the area of effect suffers 1 Damage of your weapon's type before
 * determining if your attack was successful." Unconditional on the attack roll's own hit/miss -
 * applied directly to whichever tokens the AoE shape actually caught (see
 * helpers/aoe-targeting.mjs#placeAoeTemplate's own return value), before the roll even happens,
 * the same "flat damage independent of the roll" shape Fortitude/Extra Plates already use, just
 * per-target instead of self-only.
 */
const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
const HORSESHOES_AND_HANDGRENADES_ID = `${GI_JOE_CRB}NYwpiTjlKxTB2rGF`;

/**
 * Applies the flat 1-damage tax to every token an explosive AoE attack's shape caught, if the
 * attacker holds the Perk.
 * @param {Actor} actor   The attacker.
 * @param {Item} item   The weaponEffect being rolled.
 * @param {Array<Token>} tokens   Tokens caught by the AoE shape.
 */
export async function applyHorseshoesAndHandgrenades(actor, item, tokens) {
  const isExplosiveAttack = item?.type == 'weaponEffect' && item.system.classification?.style == 'explosive';
  if (!isExplosiveAttack || !actorHasPerk(actor, HORSESHOES_AND_HANDGRENADES_ID)) {
    return;
  }

  for (const token of tokens) {
    if (token.actor) {
      await applyDamage(token.actor, 1, item.system.damageType);
    }
  }
}
