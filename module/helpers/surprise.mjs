import { getNearbyEnemyTokens } from "./enemies.mjs";

/**
 * Perks that inflict the Surprised Condition.
 *
 * The Condition itself was added 2026-09-15 (helpers/config.mjs) after being the single most-cited
 * blocker in this project's own ledger behind action economy. This file is the first thing to
 * actually APPLY it - Stalk, built the same day, only granted immunity to it.
 *
 * Every Perk here inflicts Surprise "before combat begins" or "on the first round", which this
 * system can check directly: game.combat.round == 1. That is unusually enforceable for this
 * project, where most timing qualifiers get dropped, so it is enforced rather than trusted.
 */
export const QUICK_AND_QUIET_ID = "Compendium.essence20.knights_of_canterlot.Item.nMS83Zn6qgFpIpmE";
export const VOICE_OF_NIGHT_VALE_ID = "Compendium.essence20.wtnv_citizens_guide.Item.wC7hyjoYTVRQo5LZ";

// Rallying Cry (WTNV Citizens' Guide, Journalist Role Perk, p.37): "As a Free action during your
// first round in Combat, you can attempt a DIF 10 Performance Skill Test. On a success, you
// Surprise one enemy within your reach. On a Critical Success, you Surprise up to three enemies."
//
// NOT the identically-named GI Joe CRB Perk, which is a different item with different text and
// has been built on team-buffs.mjs for some time - compare ids, not names.
export const WTNV_RALLYING_CRY_ID = "Compendium.essence20.wtnv_citizens_guide.Item.Qdb9Jj4UAAE0YbhE";

const VOICE_OF_NIGHT_VALE_RADIUS_FEET = 60;

// Rallying Cry's own limits: one enemy normally, up to three on a Critical Success.
export const RALLYING_CRY_TARGET_LIMIT = 1;
export const RALLYING_CRY_CRIT_TARGET_LIMIT = 3;

/**
 * Whether it is still the surprise round - the first round of an active combat. Both Perks here
 * are scoped to it, and neither does anything afterward.
 * @returns {Boolean}
 */
export function isSurpriseRound() {
  return game.combat?.round == 1;
}

/**
 * Quick and Quiet (Knights of Canterlot, Influence Perk, p.36): "You can always Surprise a creature
 * on the first round of combat without a Skill Test."
 *
 * "Always... without a Skill Test" is the whole mechanic: no roll, no contest, no cost. So this is
 * a plain marking of whichever token the player has targeted - the same auto-detect idiom Mark
 * Target and Fight Me! already use - rather than anything that goes through rollSkill. RAW says "a
 * creature", singular, so only the first target is affected even if several are selected.
 * @param {Actor} _actor   Unused - kept only for a consistent onPerkUse dispatch signature.
 * @returns {Promise<Actor|null>}   The creature Surprised, or null if there was nothing to mark.
 */
export async function activateQuickAndQuiet(_actor) {
  const target = game.user?.targets?.first()?.actor;
  if (!target) {
    ui.notifications.warn(game.i18n.localize('E20.QuickAndQuietNoTarget'));
    return null;
  }

  await target.toggleStatusEffect('surprised', { active: true });
  return target;
}

/**
 * How many enemies Rallying Cry Surprises on a successful roll - see WTNV_RALLYING_CRY_ID's own
 * comment above.
 * @param {Boolean} isCrit
 * @returns {Number}
 */
export function getRallyingCryTargetLimit(isCrit) {
  return isCrit ? RALLYING_CRY_CRIT_TARGET_LIMIT : RALLYING_CRY_TARGET_LIMIT;
}

/**
 * Voice of Night Vale (WTNV Citizens' Guide, General Perk, p.47): "When you roll Initiative to
 * determine action order, you can make an Intimidation Skill Test against your enemies' Willpower
 * Defense. If successful, you Surprise your enemies before combat begins."
 *
 * "Your enemies" plural, resolved by one roll compared against each of their Willpower Defenses -
 * exactly the shape Absolute Menace already established, and for the same reason: a plain
 * (non-weaponEffect) Skill Test rolled with several tokens targeted evaluates ONE roll against
 * each target's own Defense, so no new roll-comparison logic is needed. The two differences from
 * Absolute Menace are that this costs nothing and applies Surprised instead of Frightened.
 *
 * RAW names no radius at all ("your enemies"), so the 60ft used here is a judgment call - the same
 * radius this project's other broadcast effects use (team-buffs.mjs) - rather than RAW. Unbounded
 * targeting would sweep in enemies across the whole scene.
 * @param {Actor} actor
 */
export async function activateVoiceOfNightVale(actor) {
  const enemies = getNearbyEnemyTokens(actor, VOICE_OF_NIGHT_VALE_RADIUS_FEET);
  canvas.tokens.setTargets(enemies.map(token => token.id));

  await actor._dice.rollSkill({
    skill: 'intimidation',
    essence: 'social',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'willpower',
    isVoiceOfNightVale: true,
  }, actor);
}
