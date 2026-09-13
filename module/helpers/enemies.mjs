/**
 * The disposition-inverted mirror of helpers/allies.mjs#getNearbyAllyTokens - every token within
 * radiusFeet of the actor's own token whose disposition DIFFERS from the actor's own (rather than
 * matches it). First needed by Absolute Menace (Beneath the Helmet, Dark Ranger, 18th level,
 * p.40), flagged in the original categorization pass as reusable infrastructure for later AoE-
 * Skill-Test-vs-Defense Perks too (Elemental Storm, Supreme Guardian, etc.).
 * @param {Actor} actor
 * @param {Number} radiusFeet
 * @returns {Array<Token>}
 */
export function getNearbyEnemyTokens(actor, radiusFeet) {
  const actorToken = actor?.getActiveTokens?.()?.[0];
  if (!actorToken || !canvas?.tokens || !canvas?.grid) {
    return [];
  }

  return canvas.tokens.placeables.filter(token =>
    token !== actorToken && token.actor
    && token.document.disposition !== actorToken.document.disposition
    && canvas.grid.measurePath([token.center, actorToken.center]).distance <= radiusFeet,
  );
}
