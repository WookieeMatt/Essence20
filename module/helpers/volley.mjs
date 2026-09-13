import { roleValueChange } from "../sheet-handlers/role-handler.mjs";

// Volley (Power Rangers CRB, Pink Ranger, 1st level, p.48): "By spending 1 Personal Power, you
// may make a special Volley attack action as long as you do not move. This Volley attack action
// allows you to make a number of ranged attacks against valid targets equal to the Volley Shots
// number... Range, cover, and other modifiers apply to these targets INDIVIDUALLY." Unlike
// Whirlwind Strike's own corrected build (a single roll vs. many Defenses), this genuinely IS the
// "Multiple Targets" trait's own real mechanic (an independent re-roll per target) - see
// helpers/multiple-targets.mjs's own doc comment for the distinction this project has now drawn
// twice. A plain on/off toggle (Power Boost's own shape: pay 1 Power to switch ON, free to switch
// back OFF) rather than an auto-target - the player selects their own targets as normal for any
// multi-target roll in this system, up to however many the fiction supports; the "Volley Shots"
// number itself isn't mechanically capped anywhere in this codebase (same as Charge Into Battle's
// own "Multiple Targets (2)" grant), so only getVolleyShots (below, used by Penetrating Shot) ever
// reads it. "As long as you do not move" is an unenforceable narrative qualifier, dropped.

const VOLLEY_FLAG = 'volleyActive';

export function isVolleyActive(actor) {
  return !!actor?.getFlag?.('essence20', VOLLEY_FLAG);
}

/**
 * Toggles Volley - switching ON costs 1 Personal Power, switching back OFF is free.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}   The new state, or null if switching ON was unaffordable.
 */
export async function toggleVolley(actor) {
  if (isVolleyActive(actor)) {
    await actor.unsetFlag('essence20', VOLLEY_FLAG);
    return false;
  }

  if (actor.system.powers.personal.value < 1) {
    return null;
  }

  await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
  await actor.setFlag('essence20', VOLLEY_FLAG, true);
  return true;
}

/**
 * The actor's current Volley Shots value (Pink Ranger's own scaling "base" rolePoints item,
 * bonus.type "other" - not one of the generically-handled attackUpshift/damageBonus/healthBonus/
 * defenseBonus types dice.mjs/_prepareHealth/_prepareDefenses already read). Falls through to the
 * normal startingValue+roleValueChange computation at level 20 too, since this item's own
 * level20Value is unset (null) - unlike Hardened Armor's identically-shaped getter, which can
 * trust level20Value because that one actually has a real value there.
 * @param {Actor} actor
 * @returns {Number}
 */
export function getVolleyShots(actor) {
  const rolePoints = actor._getBaseRolePoints?.();
  if (!rolePoints || rolePoints.system.bonus.type != 'other') {
    return 0;
  }

  if (actor.system.level == 20 && rolePoints.system.bonus.level20Value != null) {
    return rolePoints.system.bonus.level20Value;
  }

  return rolePoints.system.bonus.startingValue + roleValueChange(actor.system.level, rolePoints.system.bonus.increaseLevels);
}
