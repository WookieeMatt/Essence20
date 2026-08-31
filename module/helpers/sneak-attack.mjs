import { actorHasPerk, findPerk, hasUsedThisRound, markUsedThisRound } from "./perks.mjs";
import { roleValueChange } from "../sheet-handlers/role-handler.mjs";

/**
 * GI Joe CRB p.72 - the Commando Role's Sneak Attack Perk:
 * "Once per turn, when using a silent weapon to attack a target within 20 feet, and you have an
 * Edge on the attack or an ally also within 20 feet of the target, you deal additional damage
 * once per turn. The amount of extra damage is shown on the Commando Role chart."
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
 * (perk-handler.mjs's SORCERY_PERK_ID/ZORD_PERK_ID, generalized here as helpers/perks.mjs's
 * actorHasPerk()) - only GI Joe's actual Commando Perks/Sneak Attack Damage Item get this
 * automation; any other damageBonus Role Points Item (Power Rangers' Power Strike, My Little
 * Pony's Hard Hitter) still gets a working manual toggle (see dice.mjs), just without an
 * auto-computed default, since their own trigger conditions haven't been read from their books
 * yet.
 */

const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
const SNEAK_ATTACK_DAMAGE_ID = `${GI_JOE_CRB}Mrmbqza0XxVpKj6U`;
const EVERYTHING_A_WEAPON_ID = `${GI_JOE_CRB}hx4KzTl8iQ8Z22eq`;
const EVERY_TRICK_IN_THE_BOOK_ID = `${GI_JOE_CRB}HKv38GCtVdSV2qMH`;
const NEVER_HEARD_IT_COMING_ID = `${GI_JOE_CRB}jIUKR6chHdKQO2vr`;
const IN_MY_SIGHTS_ID = `${GI_JOE_CRB}MD54SjlTYiCTvmBB`;
const BALLISTIC_ADVANTAGE_ID = `${GI_JOE_CRB}civSjmz83aDYPwvo`;
// The "Sneak Attack" Perk itself (as opposed to Sneak Attack Damage above) is flavor text with no
// mechanical effect of its own - EXCEPT that this exact compendium Item is shared verbatim by both
// Commando's own base grant and Ranger/Predator's Focus grant (p.93: "you deal additional damage
// on a successful hit equal to the sneak attack of a Commando of your Ranger level"). Since a
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

  const sourceId = rolePoints.flags?.core?.sourceId ?? rolePoints._stats?.compendiumSource;
  return sourceId == SNEAK_ATTACK_DAMAGE_ID;
}

/**
 * Finds the weapon a weaponEffect belongs to - same parentId-flag lookup already used by
 * dice.mjs#_getLaserSightBonus for the same purpose.
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
 * Debilitating Strike (16th level): "after hitting a target with your sneak attack, they suffer a
 * Snag on their first Skill Test or attack on their next turn." Called from
 * dice.mjs#_rollSkillHelper once a Sneak-Attack-boosted hit actually lands; consumed (checked and
 * cleared) from dice.mjs#_getAutomaticCombatModifiers the next time that target rolls anything.
 * @param {Actor} target
 */
export async function markDebilitated(target) {
  await target.setFlag('essence20', 'debilitated', true);
}

/**
 * Computes the effective weapon-qualifier and range cap for a Sneak Attack, folding in every
 * Focus Perk that extends those two things:
 * - Everything's a Weapon (12th level): any weapon qualifies, not just silent ones.
 * - In My Sights (Sniper Focus, 3rd level): a sniper-quality weapon also qualifies, and the range
 *   cap becomes that weapon's own effective range instead of the flat 20/60ft.
 * - Ballistic Advantage (Sniper Focus, 17th level): with a sniper-quality weapon, no range cap at
 *   all.
 * - Never Heard It Coming (Infiltrator Focus, 10th level): flat range cap 20ft -> 60ft (any
 *   qualifying weapon, not sniper-specific).
 * @param {Actor} actor
 * @param {Item|null} weapon   The weaponEffect's parent weapon, if any.
 * @param {Item} weaponEffect   The weaponEffect itself - system.range lives here, NOT on the
 *   parent weapon (weapon.mjs's own schema has no range field at all; only traits does).
 * @returns {{qualifies: Boolean, rangeCap: Number|null}}   rangeCap is null when unlimited.
 * @private
 */
function _getWeaponQualifierAndRange(actor, weapon, weaponEffect) {
  const isSilentWeapon = !!weapon?.system.traits.includes('silent');
  const isSniperWeapon = !!weapon?.system.traits.includes('sniper');

  const hasInMySights = isSniperWeapon && actorHasPerk(actor, IN_MY_SIGHTS_ID);
  // Ballistic Advantage's own text ("you apply sneak attack at any range when attacking with a
  // sniper weapon") grants the weapon-qualifier itself, not just the range cap - in practice a
  // Sniper Focus character will already have In My Sights (3rd level) by the time they reach
  // Ballistic Advantage (17th level), but this doesn't assume that prerequisite is present.
  const hasBallisticAdvantage = isSniperWeapon && actorHasPerk(actor, BALLISTIC_ADVANTAGE_ID);
  const qualifies = isSilentWeapon
    || hasInMySights
    || hasBallisticAdvantage
    || actorHasPerk(actor, EVERYTHING_A_WEAPON_ID);

  if (hasBallisticAdvantage) {
    return { qualifies, rangeCap: null };
  }

  if (hasInMySights) {
    // Correction: this used to read weapon.system.range (the parent weapon), which has no range
    // field at all and so always silently fell through to the flat 20ft fallback below - found
    // while implementing the general Range for Ranged Attacks rule (dice.mjs), which needed the
    // same system.range.value/long fields and confirmed weaponEffect is the only place they live.
    const weaponRange = weaponEffect.system.range?.long || weaponEffect.system.range?.value || 20;
    return { qualifies, rangeCap: weaponRange };
  }

  const rangeCap = actorHasPerk(actor, NEVER_HEARD_IT_COMING_ID) ? 60 : 20;
  return { qualifies, rangeCap };
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
export function checkSneakAttackEligibility(actor, weaponEffect, edgeOnAttack) {
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
  if (targetToken.actor && actorHasPerk(targetToken.actor, EVERY_TRICK_IN_THE_BOOK_ID)) {
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
  const parentSourceId = parent?.flags?.core?.sourceId ?? parent?._stats?.compendiumSource;
  return parentSourceId == PREDATOR_FOCUS_ID;
}

/**
 * "deal additional damage on a successful hit equal to the sneak attack of a Commando of your
 * Ranger level" (p.93) - the exact same progression as Sneak Attack Damage's own Role Points table
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
 * - "In your environment of expertise" and "the target isn't fully aware of you (surprised, or an
 *   earlier opposed Infiltration-vs-Alertness check beat them)" have no hook to check
 *   automatically at all - this system tracks neither a scene's/actor's "environment of
 *   expertise" nor a per-target "are they aware of me" flag from an earlier roll - so this never
 *   auto-checks itself even when the checkable conditions below all pass; the reason text says so
 *   explicitly rather than silently defaulting to eligible.
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
  if (targetToken?.actor && actorHasPerk(targetToken.actor, EVERY_TRICK_IN_THE_BOOK_ID)) {
    return { eligible: false, reason: game.i18n.localize('E20.SneakAttackReasonTargetImmune') };
  }

  if (hasUsedThisRound(actor, PREDATOR_SNEAK_ATTACK_ROUND_FLAG)) {
    return { eligible: false, reason: game.i18n.localize('E20.SneakAttackReasonAlreadyUsed') };
  }

  return { eligible: false, reason: game.i18n.localize('E20.PredatorSneakAttackReasonManual') };
}
