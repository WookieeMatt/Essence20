const FLAG_KEY = 'ironBravadoAttackedThisRound';

/**
 * Iron Bravado (PR CRB, Black Spectrum Modification, replaces Whatever We Need, p.45): "When you
 * Attack an enemy, you become immune to the Frightened condition until the beginning of your next
 * turn." Stamped unconditionally whenever the holder makes an Attack (RAW says "when you Attack,"
 * not "when you hit") - called from dice.mjs#rollSkill for any weaponEffect roll. Read back by
 * condition-immunity.mjs's own checkFn escape hatch via isIronBravadoFrightenedImmune below. Same
 * "expiresRound" round-window approximation as Hup! Hup! Hup! Hup! Hup!'s own broadcast flag - a
 * plain single-round window rather than tracking whose turn is next precisely.
 * @param {Actor} actor
 */
export async function markIronBravadoAttack(actor) {
  const expiresRound = (game.combat?.round ?? 0) + 1;
  await actor.setFlag('essence20', FLAG_KEY, { combatId: game.combat?.id ?? null, expiresRound });
}

/**
 * Reads back the flag markIronBravadoAttack sets - true from the moment of the Attack through the
 * end of the same round (approximating "until the beginning of your next turn").
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isIronBravadoFrightenedImmune(actor) {
  const flag = actor.getFlag?.('essence20', FLAG_KEY);
  if (!flag) {
    return false;
  }

  return game.combat ? (game.combat.id == flag.combatId && game.combat.round <= flag.expiresRound) : true;
}
