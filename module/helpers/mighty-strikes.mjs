import { actorHasPerk } from "./perks.mjs";
import { feetToPixels, getTokensInShape } from "./aoe-targeting.mjs";

/**
 * Mighty Strikes (Blitzer Focus, 17th level, p.98): "when you make a Might melee attack, your
 * attack applies to all enemies within your reach." Unlike a real Blast/AoE weaponEffect
 * (system.shape, helpers/aoe-targeting.mjs), there's no shape to place and no click to make - the
 * area is automatic, centered on the attacker, at their own already-computed reach
 * (item.system.totalReach, data/item/weapon-effect.mjs's own prepareDerivedData). Reuses
 * aoe-targeting.mjs's own shape-containment math (getTokensInShape) and the same
 * canvas.tokens.setTargets() targeting call, so dice.mjs's existing one-shared-roll-vs-every-
 * target logic (built for Blast/AoE) resolves the attack correctly with no changes of its own -
 * a Might melee attack was never going to carry the independent-roll Multiple Targets trait
 * anyway, so "one shared roll" is the right shape here regardless.
 */
const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
const MIGHTY_STRIKES_ID = `${GI_JOE_CRB}P4agerpRunniHv6G`;

/**
 * Targets every enemy within the attacker's own reach, if they hold the Perk and this is a Might
 * melee attack.
 * @param {Actor} actor   The attacker.
 * @param {Item} item   The weaponEffect being rolled.
 * @returns {Promise<Array<Token>>}   The tokens caught, or [] if the Perk doesn't apply or the
 *   attacker has no token on the scene.
 */
export async function applyMightyStrikes(actor, item) {
  const isMightMeleeAttack = item?.type == 'weaponEffect'
    && item.system.classification?.skill == 'might' && item.system.classification?.style == 'melee';
  if (!isMightMeleeAttack || !actorHasPerk(actor, MIGHTY_STRIKES_ID)) {
    return [];
  }

  const originToken = actor.getActiveTokens?.()?.[0];
  if (!originToken) {
    return [];
  }

  const radius = feetToPixels(item.system.totalReach || 0);
  const origin = originToken.center;
  const shapeData = { type: 'circle', x: origin.x, y: origin.y, radius };

  const tokens = getTokensInShape(shapeData).filter(token => token !== originToken);
  canvas.tokens.setTargets(tokens.map(token => token.id));
  return tokens;
}
