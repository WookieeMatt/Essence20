import { actorHasPerk } from "./perks.mjs";
import { applyDamage } from "./combat.mjs";
import { isMultipleTargetsWeapon } from "./multiple-targets.mjs";

/**
 * No Need to Aim (Vanguard base, 20th level, p.111): "when you make a Multiple Targets attack,
 * you inflict one damage to all targets before rolling to attack." The exact same "flat damage,
 * before the roll, per-target" shape as Horseshoes and Handgrenades
 * (helpers/horseshoes-and-handgrenades.mjs) - just triggered by the weapon's own real
 * 'multipleTargets' trait instead of an AoE shape, and applied to whatever's currently targeted
 * via ordinary Foundry targeting. Multiple Targets attacks never go through
 * aoe-targeting.mjs's own click-to-place flow at all (see dice.mjs#rollSkill's own
 * Blast/AoE-vs-Multiple-Targets doc comment) - there's no "caught by shape" set to reuse the way
 * Horseshoes and Handgrenades reuses placeAoeTemplate's own return value.
 */
const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
const NO_NEED_TO_AIM_ID = `${GI_JOE_CRB}GHVeLpZ8opWy1Sje`;

/**
 * Applies the flat 1-damage tax to every currently-targeted token, if the attacker holds the
 * Perk and this is a real Multiple Targets attack.
 * @param {Actor} actor   The attacker.
 * @param {Item} item   The weaponEffect being rolled.
 */
export async function applyNoNeedToAim(actor, item) {
  if (!isMultipleTargetsWeapon(actor, item) || !actorHasPerk(actor, NO_NEED_TO_AIM_ID)) {
    return;
  }

  for (const token of game.user.targets) {
    if (token.actor) {
      await applyDamage(token.actor, 1, item.system.damageType);
    }
  }
}
