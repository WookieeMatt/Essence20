/**
 * Wisdom of the Elders (Through the Shattered Grid, Guardian of Eltar, 9th/18th level, p.72):
 * "Choose one of the following improvements from Table 3-3 to your Morphed form. Each
 * modification requires Personal Power or Eltarian Tech Points to activate." Same "picked ONCE
 * per instance, permanently, via a new choiceType; the player then activates/deactivates
 * whichever specific ability they picked, paying that ability's own cost each time" shape as
 * Power Adaptation (Silver Ranger) - see its own doc comment - just with a cost that can be
 * EITHER Personal Power or an Eltarian Tech Point depending on the option (`costType` below),
 * where Power Adaptation's own 5 options all cost Power.
 *
 * All 6 named options are offered in the choice picker (even Ferocious Strikes, whose "extra
 * melee Attack per Attack action" has no mechanical effect here) - the same "the Perk still
 * exists and the resource still gets spent even when the effect itself isn't automated" idiom
 * Power Adaptation's own Fast Trigger already established.
 *
 * Five options toggle an ongoing effect on/off (spending the cost only to switch ON, free to
 * switch back OFF - approximating "for 1d4/1d6 rounds/minutes/hours" as "until switched back
 * off," this project's usual duration idiom):
 * - **Lightshield Armor** (1 Power): +2 Toughness while active - a live, non-consumed read in
 *   dice.mjs's per-target checkEntries construction, the same shape Powered Plating's own
 *   Toughness bonus already established (can't touch _prepareDefenses).
 * - **Enhanced Reflexes** (1 Eltarian Tech Point): ↑2 Acrobatics/Initiative while active - read
 *   in dice.mjs#rollSkill's shift computation, the same shape Crushing Strength (Power
 *   Adaptation) already established.
 * - **Lightfoil Wings** (2 Eltarian Tech Points): Aerial Movement = Ground Movement while active -
 *   read in documents/actor.mjs#_prepareMovement, alongside Boost of Speed's identical pattern.
 * - **Resilient Armor** (2 Power): ignore 1 damage per hit while active - a flat, always-on -1 to
 *   any incoming damage type (not scoped to Energy, unlike Adapted Wavelength's identical shape),
 *   read in helpers/combat.mjs#applyDamage. "1 damage per turn" (RAW's own wording) is
 *   approximated as "per hit while the toggle is on" - this codebase has no per-turn-reset bucket
 *   to track a once-per-turn use separately from the toggle itself.
 * - **Ferocious Strikes** (3 Power): "one additional melee Attack per Attack action" - Not
 *   automatable, same action-economy gap as Extra Attack itself; the toggle still exists purely
 *   to track and pay the cost for the GM to adjudicate narratively.
 *
 * The sixth, **Teleportation** (1 Eltarian Tech Point), is an instant effect, not a toggle - see
 * activateWisdomOfTheEldersTeleportation's own doc comment below.
 */
const WISDOM_OF_THE_ELDERS_FLAG = 'wisdomOfTheEldersActive';

export const WISDOM_OF_THE_ELDERS_OPTIONS = {
  teleportation: { cost: 1, costType: 'eltarianTech' },
  lightshieldArmor: { cost: 1, costType: 'power' },
  enhancedReflexes: { cost: 1, costType: 'eltarianTech' },
  lightfoilWings: { cost: 2, costType: 'eltarianTech' },
  resilientArmor: { cost: 2, costType: 'power' },
  ferociousStrikes: { cost: 3, costType: 'power' },
};

/**
 * Whether the actor can currently afford the given option's own activation cost.
 * @param {Actor} actor
 * @param {String} option   One of WISDOM_OF_THE_ELDERS_OPTIONS' own keys.
 * @returns {Boolean}
 */
export function canAffordWisdomOfTheElders(actor, option) {
  const { cost, costType } = WISDOM_OF_THE_ELDERS_OPTIONS[option];
  if (costType == 'power') {
    return actor.system.powers.personal.value >= cost;
  }

  return (actor._getBaseRolePoints?.()?.system.resource.value ?? 0) >= cost;
}

/**
 * Spends the given option's own cost (Power or an Eltarian Tech Point).
 * @param {Actor} actor
 * @param {String} option
 */
async function spendWisdomOfTheEldersCost(actor, option) {
  const { cost, costType } = WISDOM_OF_THE_ELDERS_OPTIONS[option];
  if (costType == 'power') {
    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - cost });
    return;
  }

  const eltarianTech = actor._getBaseRolePoints();
  await eltarianTech.update({ 'system.resource.value': eltarianTech.system.resource.value - cost });
}

/**
 * Whether the given Wisdom of the Elders option is currently switched on for this actor.
 * @param {Actor} actor
 * @param {String} option   One of WISDOM_OF_THE_ELDERS_OPTIONS' own keys.
 * @returns {Boolean}
 */
export function isWisdomOfTheEldersActive(actor, option) {
  return !!actor.getFlag?.('essence20', WISDOM_OF_THE_ELDERS_FLAG)?.[option];
}

/**
 * Flips the given Wisdom of the Elders option on/off for this actor. Turning it ON spends that
 * option's own cost (returns null, spending nothing, if the actor can't afford it); turning it
 * back OFF is free, same shape as togglePowerAdaptation. Not meaningful for Teleportation, which
 * is an instant effect - see activateWisdomOfTheEldersTeleportation instead.
 * @param {Actor} actor
 * @param {String} option
 * @returns {Promise<Boolean|null>}   The new state (true = now active), or null if activation
 *   couldn't be afforded (nothing is changed in that case).
 */
export async function toggleWisdomOfTheElders(actor, option) {
  const current = actor.getFlag?.('essence20', WISDOM_OF_THE_ELDERS_FLAG) ?? {};
  const nowActive = !current[option];

  if (nowActive) {
    if (!canAffordWisdomOfTheElders(actor, option)) {
      return null;
    }

    await spendWisdomOfTheEldersCost(actor, option);
  }

  await actor.setFlag('essence20', WISDOM_OF_THE_ELDERS_FLAG, { ...current, [option]: nowActive });
  return nowActive;
}

/**
 * Teleportation: "Teleport to a location you can see within 30 feet of you" for 1 Eltarian Tech
 * Point - an instant effect, not an ongoing toggle (there's nothing to switch back off). The
 * actual repositioning stays manual (a GM/player token move), the same "spend the cost, narrate
 * the rest" idiom Duty of the Silver's own teleport clause already established - only the cost
 * itself is automated here.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   False (nothing spent) if unaffordable.
 */
export async function activateWisdomOfTheEldersTeleportation(actor) {
  if (!canAffordWisdomOfTheElders(actor, 'teleportation')) {
    return false;
  }

  await spendWisdomOfTheEldersCost(actor, 'teleportation');
  return true;
}
