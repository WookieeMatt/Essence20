import { actorHasPerk } from "./perks.mjs";

/**
 * Generic "nearby allies" lookup, generalizing the same scan already duplicated privately in
 * helpers/personal-shield.mjs#getShieldUpgradeBonus and helpers/enemy-number-one.mjs (which scans
 * for nearby ENEMIES instead - the same idiom, opposite disposition check). Foundry has no
 * first-class "ally" concept of its own; every aura/ally-facing Perk automated in this system
 * keys off a token's own Disposition (set per-token on the scene) as the ally/enemy proxy, and
 * canvas.grid.measurePath for distance, same as everywhere else range gets measured in this file
 * tree (dice.mjs#_getDistanceFeet, etc.).
 */

// Frenemy (MLP CRB, General Perk, p.124): "When you use an ability that targets 'a friend', you
// can instead target any creature with it, even if you don't know them very well or you don't get
// along." Every ally-targeting Perk in this codebase (Helping Hand, Field Repair, Lend Assistance,
// and dozens more) already funnels through getNearbyAllyTokens below, so widening that ONE
// function's own Disposition filter for a Frenemy holder - rather than teaching every individual
// Perk about it - covers all of them at once.
const FRENEMY_ID = "Compendium.essence20.mlp_crb.Item.N6Bs8to6G0QddMVK";

/**
 * Finds every OTHER token within radiusFeet of the given actor's own token, sharing the same
 * Disposition (friendly/neutral/hostile) - i.e. its allies on the current scene - or, for a holder
 * of Frenemy above, every nearby token regardless of Disposition. Excludes the actor's own token.
 * Returns an empty array if the actor has no token placed on the canvas at all (no scene loaded,
 * or the actor isn't represented on this one).
 * @param {Actor} actor
 * @param {Number} radiusFeet
 * @returns {Array<Token>}
 */
export function getNearbyAllyTokens(actor, radiusFeet) {
  const actorToken = actor?.getActiveTokens?.()?.[0];
  if (!actorToken || !canvas?.tokens || !canvas?.grid) {
    return [];
  }

  const anyDisposition = actorHasPerk(actor, FRENEMY_ID);

  return canvas.tokens.placeables.filter(token =>
    token !== actorToken && token.actor
    && (anyDisposition || token.document.disposition === actorToken.document.disposition)
    && canvas.grid.measurePath([token.center, actorToken.center]).distance <= radiusFeet,
  );
}

/**
 * Finds every OTHER token within radiusFeet of the given actor's own token, regardless of
 * Disposition - i.e. allies AND enemies alike. First needed by Ground Suppression
 * (Quartermaster's Guide to Gear, Strafer Focus, Vanguard, 3rd level, p.28), whose own "friend
 * and foe" AoE is the first Perk in this project to hit BOTH dispositions at once - every prior
 * AoE either only ever hit allies (getNearbyAllyTokens) or only enemies (getNearbyEnemyTokens).
 * Excludes the actor's own token, matching both of those siblings.
 * @param {Actor} actor
 * @param {Number} radiusFeet
 * @returns {Array<Token>}
 */
export function getAllNearbyTokens(actor, radiusFeet) {
  const actorToken = actor?.getActiveTokens?.()?.[0];
  if (!actorToken || !canvas?.tokens || !canvas?.grid) {
    return [];
  }

  return canvas.tokens.placeables.filter(token =>
    token !== actorToken && token.actor
    && canvas.grid.measurePath([token.center, actorToken.center]).distance <= radiusFeet,
  );
}

/**
 * H.I.S.S. Column (GI Joe CRB, Vehicle Trait, p.302): "Every H.I.S.S. on a battlefield gains a
 * bonus to Evasion equal to the number of other H.I.S.S. on the battlefield." Unlike
 * getNearbyAllyTokens/getAllNearbyTokens above, this has no radius (the whole current scene is
 * "the battlefield") and matches by actor identity (same actor name) rather than Disposition -
 * RAW's own "other H.I.S.S." clearly means other copies of this specific named vehicle, not any
 * unrelated vehicle that happens to also carry this Trait. Excludes the actor's own token.
 * @param {Actor} actor
 * @returns {Number}
 */
export function getHissColumnBonus(actor) {
  const actorToken = actor?.getActiveTokens?.()?.[0];
  if (!actorToken || !canvas?.tokens) {
    return 0;
  }

  return canvas.tokens.placeables.filter(token =>
    token !== actorToken && token.actor
    && token.actor.name === actor.name
    && token.actor.system.traits?.hissColumn,
  ).length;
}

// Colony Changeling (Dark Skies Over Equestria, Natural Shape choice, p.17): "another +1 bonus to
// Evasion for every changeling from your colony next to you, up to +3 total."
const COLONY_CHANGELING_ID = "Compendium.essence20.dark_skies_over_equestria.Item.FRUWPAePJzm7Mlf0";
const COLONY_CHANGELING_ADJACENCY_FEET = 5;
const COLONY_CHANGELING_MAX_BONUS = 3;

/**
 * Colony Changeling - see COLONY_CHANGELING_ID's own comment above. Same "scan
 * canvas.tokens.placeables for a qualifying nearby granter" idiom getHissColumnBonus just above
 * already establishes, but adjacency-scoped (5ft, the same "next to" proxy Bulwark's own
 * _hasNearbyBulwarkCover uses) rather than whole-battlefield, and matched by the Perk itself
 * (any other Colony Changeling, not just same-named copies) rather than actor identity - "from
 * your colony" is dropped as unenforceable (this codebase has no colony/hive-membership concept),
 * the same "closest available proxy" judgment call getHissColumnBonus's own "other H.I.S.S."
 * reading already makes. Recomputed fresh every prepareData pass, so it tracks other Colony
 * Changeling tokens entering/leaving adjacency automatically.
 * @param {Actor} actor
 * @returns {Number}   0-3.
 */
export function getColonyChangelingEvasionBonus(actor) {
  const actorToken = actor?.getActiveTokens?.()?.[0];
  if (!actorToken || !canvas?.tokens || !canvas?.grid) {
    return 0;
  }

  const nearbyCount = canvas.tokens.placeables.filter(token =>
    token !== actorToken && token.actor
    && actorHasPerk(token.actor, COLONY_CHANGELING_ID)
    && canvas.grid.measurePath([token.center, actorToken.center]).distance <= COLONY_CHANGELING_ADJACENCY_FEET,
  ).length;

  return Math.min(nearbyCount, COLONY_CHANGELING_MAX_BONUS);
}
