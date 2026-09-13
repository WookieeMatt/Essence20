import { getNearbyEnemyTokens } from "./enemies.mjs";
import { actorHasPerk } from "./perks.mjs";

/**
 * Supreme Guardian (Through the Shattered Grid, Guardian of Eltar, 20th level, p.73): "When you
 * Morph, you may immediately cause the area within a 20-foot radius of you to become illuminated
 * with bright light and make a Technology Skill Test against each Threat's Toughness. On a
 * success, the Threat is Blinded for 1d6 combat rounds. After you hit with an Attack with a Melee
 * Power Weapon, you may spend any number of Eltarian Tech Points to add 1 Energy damage per Tech
 * Point spent to the total damage dealt. Whenever you take Energy damage, you may roll a d20. If
 * the roll is 10 or above, you regain 1 Eltarian Tech Point."
 *
 * Bullet 1 (this file): same Absolute-Menace-style shape as Absolute Menace/Elemental Storm/
 * Explosive Morph (auto-target every nearby enemy via canvas.tokens.setTargets(), then trigger a
 * real interactive roll via actor._dice.rollSkill() with a synthetic dataset). "When you Morph" is
 * approximated as its own "Use" button rather than intercepting the Morph toggle itself, the same
 * idiom Explosive Morph's own doc comment already established (this is the second Perk with that
 * identical "when you activate Quantum/Guardian Morph" trigger). "1d6 combat rounds" isn't
 * actively expired (no duration-tracking hook exists) - the same "grant, don't auto-revoke" idiom
 * every other Perk-applied status in this project already uses.
 *
 * Bullet 2 (getSupremeGuardianTechAvailable/spendSupremeGuardianTech, also this file, consumed in
 * dice.mjs): "spend any number of Eltarian Tech Points for +1 Energy damage each" on a melee Power
 * Weapon hit - the same "spend any amount of a banked resource for that much bonus damage" shape
 * Terror's own spend-for-damage half already established (helpers/terror.mjs), just against the
 * Guardian of Eltar's own base rolePoints resource (actor._getBaseRolePoints(), the same generic
 * lookup Eltarian Tech's own Edge-spend checkbox already uses) instead of a dedicated Terror
 * Capacity pool.
 *
 * Bullet 3 - a passive d20-vs-10 Eltarian Tech regen on taking Energy damage - lives in
 * combat.mjs instead (not here, no AoE target resolution needed).
 */
const SUPREME_GUARDIAN_ID = "Compendium.essence20.through_the_shattered_grid.Item.wrBndkBQoKkn3dLy";
const RADIUS_FEET = 20;

/**
 * Targets every enemy within 20ft and kicks off the Technology-vs-Toughness Skill Test.
 * @param {Actor} actor
 */
export async function activateSupremeGuardianBlind(actor) {
  const enemies = getNearbyEnemyTokens(actor, RADIUS_FEET);
  canvas.tokens.setTargets(enemies.map(token => token.id));

  await actor._dice.rollSkill({
    skill: 'technology',
    essence: 'smarts',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'toughness',
    isSupremeGuardianBlind: true,
  }, actor);
}

/**
 * The actor's own currently-available Eltarian Tech Points to spend on bullet 2's bonus damage
 * (0 if they don't hold Supreme Guardian at all).
 * @param {Actor} actor
 * @returns {Number}
 */
export function getSupremeGuardianTechAvailable(actor) {
  if (!actorHasPerk(actor, SUPREME_GUARDIAN_ID)) {
    return 0;
  }

  return actor._getBaseRolePoints?.()?.system.resource.value ?? 0;
}

/**
 * Spends the given amount of Eltarian Tech Points (capped at what's actually available by the
 * caller via getSupremeGuardianTechAvailable, so a stale/tampered dialog value can never
 * overspend).
 * @param {Actor} actor
 * @param {Number} amount
 */
export async function spendSupremeGuardianTech(actor, amount) {
  const eltarianTech = actor._getBaseRolePoints?.();
  if (!eltarianTech || amount <= 0) {
    return;
  }

  const newValue = Math.max(0, eltarianTech.system.resource.value - amount);
  await eltarianTech.update({ 'system.resource.value': newValue });
}
