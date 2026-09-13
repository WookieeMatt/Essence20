/**
 * Power Adaptation (Across the Stars, Silver Ranger, 9th/18th level, p.57): "Choose one of the
 * following improvements on Table 2-13: Power Adaptations to your Morphed form; each requires
 * Personal Power to activate." Unlike Grid Surge (helpers/grid-surge.mjs), which picks fresh from
 * every option on each use, this Perk is picked ONCE per instance (permanently, at level-up,
 * via the new `powerAdaptation` choiceType in sheet-handlers/perk-handler.mjs#setPerkValues,
 * recorded as this Perk item's own `system.choice`) - the player gets to activate/deactivate
 * whichever specific ability they picked, as many times as they like, each activation paying that
 * ability's own Personal Power cost. `selectionLimit: 2` on the compendium item lets a Silver
 * Ranger pick this Perk twice (9th and 18th level), typically choosing two different abilities.
 *
 * All five named options are offered in the choice picker (even Fast Trigger, which has no
 * mechanical effect here) - the same "the Perk still exists and the resource still gets spent even
 * when the effect itself isn't automated" idiom Whatever Helps/Personal Sacrifice's own unautomated
 * halves already established, rather than hiding an otherwise-legal RAW choice.
 *
 * Three options toggle an ongoing effect on/off (same on/off-switch shape as Power Boost -
 * spending Power only to switch ON, free to switch back OFF - approximating "for 1d6 minutes" as
 * "until the player turns it back off," this project's usual duration idiom):
 * - **Boost of Speed** (1 Power): +20ft to ground Movement while active - read in
 *   documents/actor.mjs#_prepareMovement, alongside Warrior Rush's identical pattern.
 * - **Crushing Strength** (1 Power): ↑2 Athletics/Brawn Skill Tests while active - read in
 *   dice.mjs#rollSkill's shift computation.
 * - **Striking Hands** (1 Power): ↑1 unarmed Attacks while active - read in dice.mjs#rollSkill,
 *   gated on the same "no parent weapon" unarmed-attack proxy Phantom Ranger Prime already uses.
 * - **Fast Trigger** (2 Power): "make an additional ranged Attack per Attack action" - Not
 *   automatable, same action-economy gap as Extra Attack itself; the toggle still exists purely
 *   to track and pay the Power cost for the GM to adjudicate narratively.
 *
 * The fifth, **Regenerating Shell** (2 Power), is instead a recurring per-turn heal (not a stat
 * modifier to read elsewhere) - see healRegeneratingShellAtTurnEnd's own doc comment below for why
 * it's wired into essence20.mjs's existing combatTurn/combatRound hooks alongside Stun's own
 * per-turn heal, rather than the plain toggle shape the other four use.
 */
const POWER_ADAPTATION_FLAG = 'powerAdaptationActive';

export const POWER_ADAPTATION_OPTIONS = {
  boostOfSpeed: { cost: 1 },
  crushingStrength: { cost: 1 },
  strikingHands: { cost: 1 },
  fastTrigger: { cost: 2 },
  regeneratingShell: { cost: 2 },
};

/**
 * Whether the given Power Adaptation option is currently switched on for this actor.
 * @param {Actor} actor
 * @param {String} option   One of POWER_ADAPTATION_OPTIONS' own keys.
 * @returns {Boolean}
 */
export function isPowerAdaptationActive(actor, option) {
  return !!actor.getFlag?.('essence20', POWER_ADAPTATION_FLAG)?.[option];
}

/**
 * Flips the given Power Adaptation option on/off for this actor. Turning it ON spends that
 * option's own Personal Power cost (returns null, spending nothing, if the actor can't afford it);
 * turning it back OFF is free, same shape as togglePowerBoost.
 * @param {Actor} actor
 * @param {String} option   One of POWER_ADAPTATION_OPTIONS' own keys.
 * @returns {Promise<Boolean|null>}   The new state (true = now active), or null if activation
 *   couldn't be afforded (nothing is changed in that case).
 */
export async function togglePowerAdaptation(actor, option) {
  const current = actor.getFlag?.('essence20', POWER_ADAPTATION_FLAG) ?? {};
  const nowActive = !current[option];

  if (nowActive) {
    const cost = POWER_ADAPTATION_OPTIONS[option].cost;
    if (actor.system.powers.personal.value < cost) {
      return null;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - cost });
  }

  await actor.setFlag('essence20', POWER_ADAPTATION_FLAG, { ...current, [option]: nowActive });
  return nowActive;
}

/**
 * Regenerating Shell's own per-turn heal - called from essence20.mjs's own combatTurn/combatRound
 * hooks for whoever's turn is ENDING (see that hook's own comment for why combat.combatant, read
 * before the update commits, is the right lookup here rather than the new turn's actor
 * healStunAtTurnStart uses). A no-op unless the actor has switched this option on, and capped at
 * the actor's own max Health - "for 1d6 turns" is approximated as "until switched back off," the
 * same duration idiom the other four Power Adaptation options already use above.
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export async function healRegeneratingShellAtTurnEnd(actor) {
  if (!isPowerAdaptationActive(actor, 'regeneratingShell')) {
    return;
  }

  const { value, max } = actor.system.health;
  if (value < max) {
    await actor.update({ 'system.health.value': Math.min(max, value + 1) });
  }
}
