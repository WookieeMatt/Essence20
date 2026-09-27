import { E20 } from "./config.mjs";

/**
 * Studious Measures (Decepticon Directive, Cybertroid Focus, 3rd level, p.55): "When you make a
 * creature your Primary Quarry, you learn their maximum Health, any Hang-Ups they possess, and any
 * specific Resistances or Weaknesses the GM can divulge."
 *
 * "Primary Quarry" itself (the base Role Perk this one piggybacks on) isn't tracked anywhere in
 * this codebase - no other Perk reads or sets a "quarry" flag - so rather than build that whole
 * base mechanic just to hang this one clause off it, this Perk's own "Use" button both designates
 * the current target AND immediately reveals the facts, in one action - the same "pure information
 * reveal about whichever token is currently targeted" shape helpers/chrono-file-access.mjs already
 * establishes. "Weaknesses" has no modeled concept anywhere in this codebase (only Resistance/
 * Immunity per damage type exist) - only those two are reported.
 */

/**
 * Builds the chat message content revealing the currently-targeted actor's max Health, Hang-Ups,
 * and Resistances/Immunities - or null (and a warning) if nothing is targeted.
 * @param {Actor} _actor   Unused - kept only for a consistent onPerkUse dispatch signature.
 * @returns {String|null}
 */
export function revealStudiousMeasuresQuarry(_actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.StudiousMeasuresNoTarget'));
    return null;
  }

  const hangUps = (targetActor.items?.filter(item => item.type == 'hangUp') ?? []).map(item => item.name);

  const resistances = Object.entries(E20.damageTypes)
    .filter(([key]) => targetActor.system.resistances?.[key] || targetActor.system.immunities?.[key])
    .map(([key, label]) => (targetActor.system.immunities?.[key]
      ? game.i18n.format('E20.StudiousMeasuresImmuneTo', { damageType: game.i18n.localize(label) })
      : game.i18n.format('E20.StudiousMeasuresResistantTo', { damageType: game.i18n.localize(label) })));

  return game.i18n.format('E20.StudiousMeasuresResult', {
    target: targetActor.name,
    maxHealth: targetActor.system.health?.max ?? 0,
    hangUps: hangUps.length ? hangUps.join(', ') : game.i18n.localize('E20.StudiousMeasuresNoHangUps'),
    resistances: resistances.length ? resistances.join(', ') : game.i18n.localize('E20.StudiousMeasuresNoResistances'),
  });
}
