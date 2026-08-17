/**
 * Returns the effective numeric value of one of an actor's four Defenses (Toughness, Evasion,
 * Willpower, Cleverness; p.168-169). Player Character/Companion actors compute the final value
 * into system.defenses[type].total (Essence20Actor#_prepareDefenses); every other actor type
 * (NPC, Vehicle, Zord, Megaform) stores it directly as system.defenses[type].value.
 * @param {Actor} actor
 * @param {String} defenseType
 * @returns {Number}
 */
export function getDefenseValue(actor, defenseType) {
  const defense = actor.system.defenses?.[defenseType];
  return defense?.total ?? defense?.value ?? 0;
}

/**
 * Applies the Degrees of Success rule (p.169): a result of double the Difficulty applies the
 * numeric effect (Damage, etc.) twice, triple applies it three times, and so on.
 * @param {Number} total   The rolled Skill Test result.
 * @param {Number} difficulty   The Difficulty (a flat DIF or a target's Defense) being tested.
 * @returns {Number}   0 on a miss, otherwise the number of times the effect applies (minimum 1).
 */
export function computeMultiplier(total, difficulty) {
  if (!difficulty || total < difficulty) {
    return 0;
  }

  return Math.max(1, Math.floor(total / difficulty));
}

/**
 * Applies damage to an actor, zeroing it out first if the actor is Immune to the given damage
 * type. Resistance does NOT reduce damage here (p.170: "that means that any form of that damage
 * always has a Snag when rolling tests to apply to the creature or object" - the halved-damage
 * clause only covers the no-roll-involved case, which never applies to this system's automated
 * attack/check pipeline, where the Snag is instead applied to the attack roll itself by
 * Dice#_getAutomaticCombatModifiers). Once a Resistant target is actually hit, the damage lands
 * in full. damageType keys are shared between weaponEffect.damageType and
 * actor.resistances/immunities, so this applies uniformly to whatever effect type the attack was
 * defined with.
 *
 * Stun-type damage doesn't reduce Health at all - it instead adds to the separate
 * system.stun.value accumulator (shown on the sheet as "Stun / Health" and reset to 0 on a
 * rest), which is how this system tracks stun buildup rather than a depleting pool. Every other
 * damage type subtracts from system.health.value as normal, floored at 0.
 * @param {Actor} actor
 * @param {Number} damageValue
 * @param {String} damageType
 * @returns {Promise<Number>}   The amount actually applied (0 if Immune), clamped to how much
 *   Health the actor had left when damageType isn't 'stun'.
 */
export async function applyDamage(actor, damageValue, damageType) {
  const amount = actor.system.immunities?.[damageType] ? 0 : damageValue;

  if (damageType == 'stun') {
    await actor.update({ 'system.stun.value': actor.system.stun.value + amount });
    return amount;
  }

  const previousValue = actor.system.health.value;
  const newValue = Math.max(0, previousValue - amount);
  await actor.update({ 'system.health.value': newValue });

  return previousValue - newValue;
}

/**
 * Builds the ChatMessage.create() data for a resolved attack or vs-Difficulty Skill Test,
 * rendering templates/chat/check-card.hbs with one row per result.
 * @param {Roll} roll   The already-evaluated Roll.
 * @param {Object} options
 * @param {String} options.flavor   The roll's flavor/label text.
 * @param {Array<Object>} options.results   [{name, targetUuid, difficulty, showDifficulty,
 *   success, multiplier, damageValue, damageTypeLabel, damageType}, ...]
 * @param {Object} options.speaker   ChatMessage speaker data.
 * @param {Boolean} options.canCritD2
 * @returns {Promise<Object>}   The data object to pass to ChatMessage.create().
 */
export async function buildCheckChatData(roll, { flavor, results, speaker, canCritD2 }) {
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/essence20/templates/chat/check-card.hbs",
    {
      flavor,
      results,
      rollHTML: await roll.render(),
    },
  );

  return {
    content,
    rolls: [roll],
    speaker,
    flags: { essence20: { canCritD2 } },
    rollMode: game.settings.get('core', 'rollMode'),
  };
}
