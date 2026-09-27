import { actorHasPerk, findPerk } from "./perks.mjs";

/**
 * GI Joe CRB p.107-108 - the Vanguard Role's Personal Shield. Its Toughness/Evasion bonus is
 * already fully modeled as an ordinary `defenseBonus`-type Role Points Item (correct per-level
 * progression, gated on the sheet's own Active toggle exactly like every other activatable Role
 * Points bonus) - documents/actor.mjs#_prepareDefenses already applies it to the Vanguard's OWN
 * defenses with no changes needed here. This file only covers Shield Upgrade (5th level): "When
 * you activate your personal shield, it extends out 10 feet around you to provide its benefits to
 * your allies" - a cross-actor, token-distance check no single actor's own derived-data prep can
 * express on its own, so it's resolved at roll time instead (dice.mjs#rollSkill, alongside
 * helpers/combat.mjs#getDefenseValue) rather than inside _prepareDefenses.
 */

const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
const PERSONAL_SHIELD_ROLE_POINTS_ID = `${GI_JOE_CRB}84JYgd6kZgY41wge`;
// Exported for helpers/shield-modulation.mjs, which needs to recognize the same "protection
// extended to nearby allies" gate this file's own getShieldUpgradeBonus already checks.
export const SHIELD_UPGRADE_ID = `${GI_JOE_CRB}ep0OFsU1QIuRpHeR`;

// Protector's Shield (Bodyguard Focus, 10th level, p.110): "While your shield is up, you gain 1
// Temporary Health." See applyProtectorsShieldHealthBonus's own doc comment below.
const PROTECTORS_SHIELD_ID = `${GI_JOE_CRB}tGdWBibKFTYfXzVu`;

/**
 * Protector's Shield's own Temporary Health half - called from base-actor-sheet.mjs's own
 * Personal Shield Activate/Deactivate click, right alongside the plain isActive toggle (the same
 * "intercept the existing Activate click" shape Shield Modulation's own damage-type picker already
 * establishes), since there's no isMorphed-style single flip-point to hook otherwise. A no-op for
 * anyone who doesn't hold the Perk - safe to call unconditionally from that one shared click
 * handler. Applied as a flat system.health.bonus add/remove, the same "add on activation, remove
 * on deactivation" shape Boosted Vigor's own Temporary Health grant already establishes.
 * @param {Actor} actor
 * @param {Boolean} activating   Whether the shield is being switched ON (true) or OFF (false).
 * @returns {Promise<void>}
 */
export async function applyProtectorsShieldHealthBonus(actor, activating) {
  if (!actorHasPerk(actor, PROTECTORS_SHIELD_ID)) {
    return;
  }

  const delta = activating ? 1 : -1;
  await actor.update({ 'system.health.bonus': (actor.system.health.bonus || 0) + delta });
}

/**
 * Whether the given Role Points Item is GI Joe's own Personal Shield grant, not just some other
 * Role's defenseBonus Item. Exported for helpers/shield-modulation.mjs, which needs to recognize
 * this same Item from the actor sheet's own Activate click - see that file's own doc comment.
 * @param {Item} rolePoints
 * @returns {Boolean}
 */
export function isPersonalShieldItem(rolePoints) {
  if (!rolePoints) {
    return false;
  }

  const sourceId = rolePoints.flags?.core?.sourceId ?? rolePoints._stats?.compendiumSource;
  return sourceId == PERSONAL_SHIELD_ROLE_POINTS_ID;
}

/**
 * Whether the given actor's own base Role Points Item is specifically GI Joe's Personal Shield
 * grant (not just any defenseBonus Role Points Item - other Roles have their own), and it's
 * currently switched on via the sheet's existing Active toggle. Same shape as
 * reckless-abandon.mjs#isRecklessAbandonActive - used by Impenetrable Shield/Shield Modulation
 * below, which key their own bonus on the shield actually being active, not just present.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isPersonalShieldActive(actor) {
  const rolePoints = actor._getBaseRolePoints?.();
  return isPersonalShieldItem(rolePoints) && !!rolePoints.system.isActive;
}

/**
 * Computes the Shield Upgrade bonus a nearby Vanguard extends to the given actor's Toughness/
 * Evasion, on top of whatever that actor's own _prepareDefenses() already computed. If more than
 * one Shield-Upgraded ally is in range, the highest bonus among them applies (their bonuses don't
 * stack - nothing in the rule suggests they should).
 * @param {Actor} targetActor   The actor whose Defense is being checked against.
 * @param {String} defenseType
 * @returns {Number}   0 if no qualifying nearby Vanguard applies.
 */
export function getShieldUpgradeBonus(targetActor, defenseType) {
  if (!['toughness', 'evasion'].includes(defenseType)) {
    return 0;
  }

  const targetToken = targetActor.getActiveTokens?.()?.[0];
  if (!targetToken || !canvas?.tokens) {
    return 0;
  }

  let bestBonus = 0;

  for (const token of canvas.tokens.placeables) {
    if (token === targetToken || !token.actor || token.document.disposition !== targetToken.document.disposition) {
      continue;
    }

    const shieldRolePoints = token.actor._getBaseRolePoints?.();
    if (!isPersonalShieldItem(shieldRolePoints) || !shieldRolePoints.system.isActive) {
      continue;
    }

    if (!shieldRolePoints.system.bonus.defenseBonus[defenseType]) {
      continue;
    }

    if (!findPerk(token.actor, SHIELD_UPGRADE_ID)) {
      continue;
    }

    if (canvas.grid.measurePath([token.center, targetToken.center]).distance <= 10) {
      bestBonus = Math.max(bestBonus, shieldRolePoints.system.bonus.value);
    }
  }

  return bestBonus;
}
