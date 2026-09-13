import { getDefenseValue } from "./combat.mjs";

/**
 * Chrono-File Access (A Jump Through Time, Grid Power, p.57): "By spending a Standard action and
 * 1 Personal Power, you may learn an enemy's highest Defense value, its most damaging Attack, and
 * any Hang-Ups it might have."
 *
 * A pure information reveal (no dice, no status effect) - same "reveal facts about whichever token
 * is currently targeted" shape as Quick Study's own revealTargetDefenses, just a different set of
 * facts. The Power cost itself is already spent generically by
 * sheet-handlers/power-handler.mjs#powerCost before onPowerUse ever runs.
 */

/**
 * Builds the chat message content revealing the currently-targeted actor's highest Defense, most
 * damaging Attack (by printed base damageValue, ignoring situational bonuses this project has no
 * way to precompute for an arbitrary future roll), and Hang-Ups.
 * @param {Actor} actor
 * @returns {String|null}   The chat content, or null (and a warning) if nothing is targeted.
 */
export function revealTargetChronoFile(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.ChronoFileAccessNoTarget'));
    return null;
  }

  const defenses = { toughness: 'Toughness', evasion: 'Evasion', willpower: 'Willpower', cleverness: 'Cleverness' };
  let highestDefenseName = null;
  let highestDefenseValue = -Infinity;
  for (const [key, name] of Object.entries(defenses)) {
    const value = getDefenseValue(targetActor, key);
    if (value > highestDefenseValue) {
      highestDefenseValue = value;
      highestDefenseName = name;
    }
  }

  const weaponEffects = targetActor.items?.filter(item => item.type == 'weaponEffect') ?? [];
  const mostDamagingAttack = weaponEffects.reduce((best, current) => (
    !best || (current.system.damageValue ?? 0) > (best.system.damageValue ?? 0) ? current : best
  ), null);

  const hangUps = (targetActor.items?.filter(item => item.type == 'hangUp') ?? []).map(item => item.name);

  return game.i18n.format('E20.ChronoFileAccessResult', {
    target: targetActor.name,
    highestDefenseName,
    highestDefenseValue,
    attackName: mostDamagingAttack?.name ?? game.i18n.localize('E20.ChronoFileAccessNoAttacks'),
    attackDamage: mostDamagingAttack?.system.damageValue ?? 0,
    hangUps: hangUps.length ? hangUps.join(', ') : game.i18n.localize('E20.ChronoFileAccessNoHangUps'),
  });
}
