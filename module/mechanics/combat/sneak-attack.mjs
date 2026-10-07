import { findPerk, hasUsedThisRound, markUsedThisRound } from "../characters/perks.mjs";
import { roleValueChange } from "../../sheet-handlers/role-handler.mjs";
import { canWriteStoryPoints, hasStoryPointsAvailable, requestStoryPointSpend } from "../resources/story-points.mjs";
import { isKnownOutsideEnvironmentOfExpertise, meetsEnvironmentOfExpertise } from "../world/environmental-expertise.mjs";
// Every Trick in the Book's "no sneak attack damage" is a SneakAttackImmunity rule on its pack item.
import { ruleSneakAttackImmune } from "../../rules/plugins/combat/immunity-readers.mjs";
// Everything's a Weapon, Never Heard It Coming, Focused Charge and Sudden Strike are SneakAttackGrant rules on their pack items.
import { anyCircumstanceGrant, bypassGrant, grantStoryPointCost, recordGrantUse, sneakAttackWeaponGrants } from "../../rules/plugins/combat/sneak-attack-grant.mjs";

/**
 * GI Joe CRB p.72 - the Commando Role's Sneak Attack Perk:
 * once a turn, a silent-weapon attack on a target within 20 feet deals extra damage (per the
 * Commando Role table) when the attack has Edge or an ally is also within 20 feet of the target.
 *
 * The damage amount itself already lives on the Commando role's granted "Sneak Attack Damage"
 * rolePoints Item (bonus.type: "damageBonus", the correct per-level progression already modeled
 * there) - this file only computes whether the fictional trigger conditions above are currently
 * met, so the Roll Options Dialog's "apply this bonus?" checkbox (dice.mjs#rollSkill) can start
 * pre-checked/unchecked instead of always defaulting to unchecked like every other Role Points
 * bonus in this system. It also houses every other Commando Focus Perk that directly extends
 * Sneak Attack itself (weapon-qualifier and range overrides, the target-side immunity, and the
 * once-per-turn damage doubler), all of which are naturally this file's own domain.
 *
 * Mirrors the hardcoded-compendium-ID pattern already used to special-case a specific Item
 * (perk-handler.mjs's SORCERY_PERK_ID/ZORD_PERK_ID, generalized here as mechanics/characters/perks.mjs's
 * actorHasPerk()) - only GI Joe's actual Commando Perks/Sneak Attack Damage Item get this
 * automation; any other damageBonus Role Points Item (Power Rangers' Power Strike, My Little
 * Pony's Hard Hitter) still gets a working manual toggle (see dice.mjs), just without an
 * auto-computed default, since their own trigger conditions haven't been read from their books
 * yet.
 */

const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
const SNEAK_ATTACK_DAMAGE_ID = `${GI_JOE_CRB}Mrmbqza0XxVpKj6U`;

// The "Sneak Attack" Perk itself (as opposed to Sneak Attack Damage above) is flavor text with no
// mechanical effect of its own - EXCEPT that this exact compendium Item is shared verbatim by both
// Commando's own base grant and Ranger/Predator's Focus grant (p.93: extra damage on a hit as for
// a Commando of the Ranger's level). Since a
// Ranger has no Sneak Attack Damage Role Points Item of their own (their Role Points resource is
// Adaptation Points, unrelated), hasPredatorSneakAttack() below has to distinguish "granted via
// Predator" from "granted via Commando" by which parent Item actually granted this actor's own
// embedded copy, not by the shared Perk id alone.
const SNEAK_ATTACK_PERK_ID = `${GI_JOE_CRB}vyOjiJFMtryduiFO`;
const PREDATOR_FOCUS_ID = `${GI_JOE_CRB}CCUJG5H6eEYRzdBQ`;
const PREDATOR_SNEAK_ATTACK_LEVELS = ['level4', 'level8', 'level13', 'level17', 'level20'];

const SNEAK_ATTACK_ROUND_FLAG = 'sneakAttackLastRound';
export const PREDATOR_SNEAK_ATTACK_ROUND_FLAG = 'predatorSneakAttackLastRound';

/**
 * Whether the given Role Points Item is GI Joe's own Sneak Attack Damage grant, not just some
 * other Role's damageBonus Item.
 * @param {Item} rolePoints
 * @returns {Boolean}
 */
export function isSneakAttackDamageItem(rolePoints) {
  if (!rolePoints) {
    return false;
  }

  const sourceId = rolePoints.flags?.core?.sourceId ?? rolePoints._stats?.compendiumSource ?? rolePoints?.flags?.essence20?.rulesSource;
  return sourceId == SNEAK_ATTACK_DAMAGE_ID;
}

/**
 * The actor's own current Sneak Attack damage bonus, for Perks that reference it OUTSIDE the
 * normal weaponEffect damage-bonus flow (e.g. Sabotage, Cobra Codex p.83: Technology
 * tests to disable machines get ↑ equal to the Sneak Attack damage). Reads the exact same
 * system.bonus.value field dice.mjs's own weaponEffect flow already reads for the ordinary Sneak
 * Attack damage bonus, so this always agrees with whatever the player sees on their own sheet -
 * not a separate startingValue/increaseLevels computation of its own.
 * @param {Actor} actor
 * @returns {Number}
 */
export function getSneakAttackDamage(actor) {
  const rolePoints = actor._getBaseRolePoints?.();
  if (!isSneakAttackDamageItem(rolePoints)) {
    return 0;
  }

  return rolePoints.system.bonus.value;
}

/**
 * Finds the weapon a weaponEffect belongs to - same parentId-flag lookup already used by
 * dice.mjs#_getParentWeapon for the same purpose.
 * @param {Actor} actor
 * @param {Item} weaponEffect
 * @returns {Item|null}
 */
function _getParentWeapon(actor, weaponEffect) {
  const parentId = weaponEffect?.flags?.essence20?.parentId;
  return parentId ? actor.items.get(parentId) : null;
}

/**
 * Measures the distance in scene units (feet, for every book this system covers) between the
 * centers of two placed Tokens.
 * @param {Token} tokenA
 * @param {Token} tokenB
 * @returns {Number}
 */
function _getDistanceFeet(tokenA, tokenB) {
  return canvas.grid.measurePath([tokenA.center, tokenB.center]).distance;
}

/**
 * Whether any other token sharing the attacker's own disposition (i.e. an ally, from the
 * attacker's side of the fight) is within 20 feet of the target token.
 * @param {Token} attackerToken
 * @param {Token} targetToken
 * @returns {Boolean}
 */
function _hasAllyNearTarget(attackerToken, targetToken) {
  return canvas.tokens.placeables.some(token =>
    token !== attackerToken
    && token.actor
    && token.document.disposition === attackerToken.document.disposition
    && _getDistanceFeet(token, targetToken) <= 20,
  );
}

/**
 * Records that this actor just applied Sneak Attack Damage this round, so a second attempt this
 * same round reads as ineligible.
 * @param {Actor} actor
 */
export async function markSneakAttackUsed(actor) {
  await markUsedThisRound(actor, SNEAK_ATTACK_ROUND_FLAG);
}

/**
 * Computes the effective weapon-qualifier and range cap for a Sneak Attack, folding in every
 * Focus Perk that extends those two things (SneakAttackGrant rules - Everything's a Weapon: any
 * weapon; Focused Charge: explosives / electromagnetic weapons; Never Heard It Coming: 60 ft; In My
 * Sights: a sniper weapon, its own range; Ballistic Advantage: a sniper weapon, any range).
 * @param {Actor} actor
 * @param {Item|null} weapon   The weaponEffect's parent weapon, if any.
 * @param {Item} weaponEffect   The weaponEffect itself - system.range lives here, NOT on the
 *   parent weapon (weapon.mjs's own schema has no range field at all; only traits does).
 * @returns {{qualifies: Boolean, rangeCap: Number|null}}   rangeCap is null when unlimited.
 * @private
 */
function _getWeaponQualifierAndRange(actor, weapon, weaponEffect) {
  const isSilentWeapon = !!weapon?.system.traits.includes('silent');
  const grants = sneakAttackWeaponGrants(actor, weaponEffect);
  const qualifies = isSilentWeapon || grants.qualifies;

  if (grants.range == 'unlimited') {
    return { qualifies, rangeCap: null };
  }

  if (grants.range == 'weapon') {
    // Correction: this used to read weapon.system.range (the parent weapon), which has no range
    // field at all and so always silently fell through to the flat 20ft fallback below - found
    // while implementing the general Range for Ranged Attacks rule (dice.mjs), which needed the
    // same system.range.value/long fields and confirmed weaponEffect is the only place they live.
    const weaponRange = weaponEffect.system.range?.long || weaponEffect.system.range?.value || 20;
    return { qualifies, rangeCap: weaponRange };
  }

  return { qualifies, rangeCap: typeof grants.range == 'number' ? grants.range : 20 };
}

/**
 * The actor's "any circumstance" SneakAttackGrant (Sudden Strike) when it has a use left and its Story Point cost can
 * be paid now, else null.
 * @param {Actor} actor
 * @returns {?Object}
 */
export function affordableSneakAttackGrant(actor) {
  const grant = anyCircumstanceGrant(actor);
  if (!grant) {
    return null;
  }

  const cost = grantStoryPointCost(grant);
  return !cost || (canWriteStoryPoints() && hasStoryPointsAvailable(cost)) ? grant : null;
}

/**
 * Pay for the "any circumstance" grant an attack needed (dice.mjs, as its Sneak Attack Damage is applied): its Story
 * Points, and one use of its limit. Nothing when none is affordable any more.
 * @param {Actor} actor
 */
export async function paySneakAttackGrant(actor) {
  const grant = affordableSneakAttackGrant(actor);
  if (!grant) {
    return;
  }

  const cost = grantStoryPointCost(grant);
  if (cost) {
    requestStoryPointSpend(actor, cost);
  }

  await recordGrantUse(actor, grant);
}

/**
 * Computes whether Sneak Attack Damage's fictional trigger conditions are currently met, to seed
 * the Roll Options Dialog checkbox's starting state (dice.mjs#rollSkill) - the checkbox itself
 * always stays player-editable regardless of this result, the same as every other toggle in that
 * dialog.
 * @param {Actor} actor   The attacking actor.
 * @param {Item} weaponEffect   The weaponEffect Item being rolled.
 * @param {Boolean} edgeOnAttack   The automatic pre-dialog Edge state for this roll
 *   (dice.mjs#rollSkill's skillDataset.edge) - a manual Edge toggle made inside the dialog itself
 *   isn't reflected here, the same timing limitation aimBonus/energonAvailable already have.
 * @returns {{eligible: Boolean, reason: String}}
 */
export function checkSneakAttackEligibility(actor, weaponEffect, edgeOnAttack, { ignoreSuddenStrike = false } = {}) {
  // Sudden Strike - a SneakAttackGrant {anyCircumstance, cost: {storyPoints}, limit} rule. Bypasses every other check
  // below ("regardless of the circumstances of your attack") while its limit lasts and its Story Point is actually
  // available to spend. The actual spend + limit happen where Sneak Attack Damage is actually applied (dice.mjs, through
  // affordableSneakAttackGrant / paySneakAttackGrant below), not here - this function only decides whether the Roll
  // Options Dialog checkbox can be offered. viaSuddenStrike is set only when the ordinary checks would have failed, so
  // dice.mjs spends the Story Point only when Sudden Strike was actually needed.
  if (!ignoreSuddenStrike && affordableSneakAttackGrant(actor)) {
    const ordinary = checkSneakAttackEligibility(actor, weaponEffect, edgeOnAttack, { ignoreSuddenStrike: true });
    if (ordinary.eligible) {
      return ordinary;
    }

    return { eligible: true, reason: game.i18n.localize('E20.SneakAttackReasonEligible'), viaSuddenStrike: true };
  }

  // A SneakAttackGrant {bypass} rule (Perfect Disguise while the disguise is on): a sneak attack whatever the weapon,
  // range, Edge or allies. Still once a round, and never against a target that can't take sneak attack damage at all.
  const bypass = bypassGrant(actor, weaponEffect);
  const fooledTarget = game.user?.targets?.first?.()?.actor;
  if (bypass && !(fooledTarget && ruleSneakAttackImmune(fooledTarget)) && !hasUsedThisRound(actor, SNEAK_ATTACK_ROUND_FLAG)) {
    return { eligible: true, reason: game.i18n.localize(String(bypass.rule.reason || 'E20.SneakAttackReasonEligible')) };
  }

  const weapon = _getParentWeapon(actor, weaponEffect);
  const { qualifies, rangeCap } = _getWeaponQualifierAndRange(actor, weapon, weaponEffect);
  if (!qualifies) {
    return { eligible: false, reason: game.i18n.localize('E20.SneakAttackReasonNotSilent') };
  }

  const attackerToken = actor.getActiveTokens()[0];
  const targetToken = game.user.targets.first();
  if (!attackerToken || !targetToken) {
    return { eligible: false, reason: game.i18n.localize('E20.SneakAttackReasonNoTarget') };
  }

  // Every Trick in the Book (12th level, General Perk): "You do not suffer sneak attack damage" -
  // an absolute immunity on the TARGET's side.
  if (targetToken.actor && ruleSneakAttackImmune(targetToken.actor)) {
    return { eligible: false, reason: game.i18n.localize('E20.SneakAttackReasonTargetImmune') };
  }

  if (rangeCap !== null && _getDistanceFeet(attackerToken, targetToken) > rangeCap) {
    return { eligible: false, reason: game.i18n.localize('E20.SneakAttackReasonOutOfRange') };
  }

  if (!edgeOnAttack && !_hasAllyNearTarget(attackerToken, targetToken)) {
    return { eligible: false, reason: game.i18n.localize('E20.SneakAttackReasonNoEdgeNoAlly') };
  }

  if (hasUsedThisRound(actor, SNEAK_ATTACK_ROUND_FLAG)) {
    return { eligible: false, reason: game.i18n.localize('E20.SneakAttackReasonAlreadyUsed') };
  }

  return { eligible: true, reason: game.i18n.localize('E20.SneakAttackReasonEligible') };
}

/**
 * Whether this actor's own embedded "Sneak Attack" Perk copy was granted by the Ranger's Predator
 * Focus specifically, not Commando's base Role grant of the same shared compendium Item - see the
 * comment on SNEAK_ATTACK_PERK_ID above.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasPredatorSneakAttack(actor) {
  const perkItem = findPerk(actor, SNEAK_ATTACK_PERK_ID);
  if (!perkItem) {
    return false;
  }

  const parent = actor.items.get(perkItem.flags?.essence20?.parentId);
  const parentSourceId = parent?.flags?.core?.sourceId ?? parent?._stats?.compendiumSource ?? parent?.flags?.essence20?.rulesSource;
  return parentSourceId == PREDATOR_FOCUS_ID;
}

/**
 * Predator's Sneak Attack: extra damage on a hit as for a Commando of the Ranger's level (p.93) - the exact same progression as Sneak Attack Damage's own Role Points table
 * (startingValue 1, +1 at each of PREDATOR_SNEAK_ATTACK_LEVELS), computed directly off the
 * Ranger's own level via the same roleValueChange() helper _prepareHealth/_prepareDefenses already
 * use for every other Role Points-style level table, since a Ranger has no Sneak Attack Damage
 * Role Points Item of their own to read the value from.
 * @param {Number} level
 * @returns {Number}
 */
export function getPredatorSneakAttackDamage(level) {
  return 1 + roleValueChange(level, PREDATOR_SNEAK_ATTACK_LEVELS);
}

/**
 * Computes whether the Ranger/Predator version of Sneak Attack's fictional trigger conditions are
 * currently met, to seed the Roll Options Dialog checkbox's starting state - same "auto-detect,
 * player can still override" role as checkSneakAttackEligibility() above, but this rule (p.93) is
 * meaningfully different, not just Commando's with different numbers:
 * - Silent weapon and once-per-round are both checkable the same way as Commando's version.
 * - "In your environment of expertise" is read from the scene's terrain when the GM has set one
 *   (mechanics/world/environmental-expertise.mjs): known to be outside it -> not eligible; in it (or the
 *   manual toggle / an Adaptation flag says so) AND the target has the Surprised Condition (the
 *   one "isn't fully aware of you" case this system tracks) -> auto-eligible.
 * - Otherwise "the target isn't fully aware of you" can't be detected (no per-target "are they
 *   aware of me" flag from an earlier opposed Infiltration-vs-Alertness roll exists), so it's left
 *   to the player; the reason text says so rather than silently defaulting to eligible.
 * @param {Actor} actor   The attacking actor.
 * @param {Item} weaponEffect   The weaponEffect Item being rolled.
 * @returns {{eligible: Boolean, reason: String}}
 */
export function checkPredatorSneakAttackEligibility(actor, weaponEffect) {
  const weapon = _getParentWeapon(actor, weaponEffect);
  if (!weapon?.system.traits.includes('silent')) {
    return { eligible: false, reason: game.i18n.localize('E20.SneakAttackReasonNotSilent') };
  }

  const targetToken = game.user.targets.first();
  if (targetToken?.actor && ruleSneakAttackImmune(targetToken.actor)) {
    return { eligible: false, reason: game.i18n.localize('E20.SneakAttackReasonTargetImmune') };
  }

  if (hasUsedThisRound(actor, PREDATOR_SNEAK_ATTACK_ROUND_FLAG)) {
    return { eligible: false, reason: game.i18n.localize('E20.SneakAttackReasonAlreadyUsed') };
  }

  if (isKnownOutsideEnvironmentOfExpertise(actor)) {
    return { eligible: false, reason: game.i18n.localize('E20.PredatorSneakAttackReasonOutsideEnvironment') };
  }

  if (meetsEnvironmentOfExpertise(actor) && targetToken?.actor?.statuses?.has?.('surprised')) {
    return { eligible: true, reason: game.i18n.localize('E20.SneakAttackReasonEligible') };
  }

  return { eligible: false, reason: game.i18n.localize('E20.PredatorSneakAttackReasonManual') };
}
