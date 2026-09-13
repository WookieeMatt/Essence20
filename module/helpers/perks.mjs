/**
 * Finds the given actor's copy of a specific Perk, identified by its compendium Item id (the same
 * hardcoded-ID pattern perk-handler.mjs already uses for SORCERY_PERK_ID/ZORD_PERK_ID -
 * `item.flags.core?.sourceId == perkId || item._stats?.compendiumSource == perkId` - generalized
 * here to scan across all of an actor's Perks instead of checking one specific dropped Item).
 * @param {Actor} actor
 * @param {String} perkId   A full compendium UUID, e.g.
 *   "Compendium.essence20.gi_joe_crb.Item.hx4KzTl8iQ8Z22eq".
 * @returns {Item|undefined}
 */
export function findPerk(actor, perkId) {
  return actor?.items?.find(item =>
    item.type == 'perk'
    && (item.flags?.core?.sourceId == perkId || item._stats?.compendiumSource == perkId),
  );
}

/**
 * Whether the given actor has a specific Perk - see findPerk() above. Use findPerk() instead when
 * the Perk's own data is needed too (e.g. a hasChoice Perk's system.choice), not just whether it's
 * present.
 * @param {Actor} actor
 * @param {String} perkId
 * @returns {Boolean}
 */
export function actorHasPerk(actor, perkId) {
  return !!findPerk(actor, perkId);
}

/**
 * Finds the given actor's copy of a specific Hang-Up - the same lookup as findPerk() above, but
 * for a genuine `type: "hangUp"` Item rather than a `type: "perk"` one. Needed because a Hang-Up's
 * own mechanical clause sometimes lives directly on the hangUp-type Item itself (e.g. Skeptic's
 * own "Persuasion Skill Tests targeting you gain an Edge") rather than on a separate `perk`-typed
 * payload Item the way an Influence's own benefit usually does - findPerk()'s strict `type ==
 * 'perk'` filter can never match a bare hangUp Item, which blocked a code-driven Hang-Up check
 * (as opposed to a passive compendium Active Effect, which doesn't care about Item type at all)
 * until now.
 * @param {Actor} actor
 * @param {String} hangUpId   A full compendium UUID.
 * @returns {Item|undefined}
 */
export function findHangUp(actor, hangUpId) {
  return actor?.items?.find(item =>
    item.type == 'hangUp'
    // Matured (Cobra Codex, General Perk, p.176): "Ignore one Influence's Hang-Up." A Hang-Up
    // the player has chosen to ignore via Matured (see helpers/matured.mjs) is flagged
    // 'maturedIgnored' - excluded here so every existing code-driven Hang-Up check (findHangUp/
    // actorHasHangUp) automatically honors it, without each individual check needing its own
    // awareness of Matured.
    && !item.getFlag?.('essence20', 'maturedIgnored')
    && (item.flags?.core?.sourceId == hangUpId || item._stats?.compendiumSource == hangUpId),
  );
}

/**
 * Whether the given actor has a specific Hang-Up - see findHangUp() above.
 * @param {Actor} actor
 * @param {String} hangUpId
 * @returns {Boolean}
 */
export function actorHasHangUp(actor, hangUpId) {
  return !!findHangUp(actor, hangUpId);
}

/**
 * Whether an actor has already used a specific once-per-round ability this combat round -
 * tracked as an actor flag storing {combatId, round} rather than anything resource-pool based,
 * since these Perks (Sneak Attack Damage, Just a Graze, ...) have no limited-use pool of their
 * own. Both the combat's id and the round number are stored so a flag left over from a finished
 * encounter never blocks a new one starting back at round 1. "Once per round" has no meaning
 * without a combat tracker running, so this is never enforced outside of active combat.
 * @param {Actor} actor
 * @param {String} flagKey   A distinct flag name per ability, e.g. "sneakAttackLastRound".
 * @returns {Boolean}
 */
export function hasUsedThisRound(actor, flagKey) {
  if (!game.combat) {
    return false;
  }

  const lastUsed = actor.getFlag?.('essence20', flagKey);
  return !!lastUsed && lastUsed.combatId == game.combat.id && lastUsed.round == game.combat.round;
}

/**
 * Records that an actor just used a once-per-round ability this round - see hasUsedThisRound().
 * No-ops outside of combat, matching hasUsedThisRound()'s own "no combat tracker, no round to
 * remember" reasoning.
 * @param {Actor} actor
 * @param {String} flagKey
 */
export async function markUsedThisRound(actor, flagKey) {
  if (!game.combat) {
    return;
  }

  await actor.setFlag('essence20', flagKey, {
    combatId: game.combat.id,
    round: game.combat.round,
  });
}

/**
 * The same idea as hasUsedThisRound() above, but scoped to a single combatant's own turn rather
 * than the whole round - a round can span several different combatants' turns, so "once per turn"
 * (e.g. Extra Plates, Renegade CRB p.115) is a narrower window than "once per round" (e.g. Sneak
 * Attack Damage). Tracks {combatId, round, turn} instead of just {combatId, round}.
 * @param {Actor} actor
 * @param {String} flagKey   A distinct flag name per ability, e.g. "extraPlatesLastTurn".
 * @returns {Boolean}
 */
export function hasUsedThisTurn(actor, flagKey) {
  if (!game.combat) {
    return false;
  }

  const lastUsed = actor.getFlag?.('essence20', flagKey);
  return !!lastUsed
    && lastUsed.combatId == game.combat.id
    && lastUsed.round == game.combat.round
    && lastUsed.turn == game.combat.turn;
}

/**
 * Records that an actor just used a once-per-turn ability - see hasUsedThisTurn(). No-ops outside
 * of combat, same reasoning as markUsedThisRound().
 * @param {Actor} actor
 * @param {String} flagKey
 */
export async function markUsedThisTurn(actor, flagKey) {
  if (!game.combat) {
    return;
  }

  await actor.setFlag('essence20', flagKey, {
    combatId: game.combat.id,
    round: game.combat.round,
    turn: game.combat.turn,
  });
}

/**
 * The widest of the three "used already" windows - scoped to a whole encounter rather than a
 * round or a single combatant's turn (e.g. Didn't Even Feel It, Renegade CRB p.97: "once per
 * encounter"). Tracks only {combatId}, not round/turn, so it stays true for every remaining round
 * of the same combat once set - only a brand new combat (a new combatId) clears it.
 * @param {Actor} actor
 * @param {String} flagKey   A distinct flag name per ability, e.g. "didntEvenFeelItThisEncounter".
 * @returns {Boolean}
 */
export function hasUsedThisEncounter(actor, flagKey) {
  if (!game.combat) {
    return false;
  }

  const lastUsed = actor.getFlag?.('essence20', flagKey);
  return !!lastUsed && lastUsed.combatId == game.combat.id;
}

/**
 * Records that an actor just used a once-per-encounter ability - see hasUsedThisEncounter().
 * No-ops outside of combat, same reasoning as markUsedThisRound()/markUsedThisTurn().
 * @param {Actor} actor
 * @param {String} flagKey
 */
export async function markUsedThisEncounter(actor, flagKey) {
  if (!game.combat) {
    return;
  }

  await actor.setFlag('essence20', flagKey, {
    combatId: game.combat.id,
  });
}

/**
 * Counting sibling of hasUsedThisEncounter/markUsedThisEncounter above, for an ability whose own
 * per-combat cap can widen (e.g. Slammer Focus's Roll with the Punches, Sgt Slaughter Sourcebook
 * p.12: usable once per combat below 6th level, twice per combat at 6th+) - same "count rather
 * than boolean" shape as getUsesThisScene/markUsedThisScene below, just keyed on the current
 * Combat instead of the current Scene.
 * @param {Actor} actor
 * @param {String} flagKey
 * @returns {Number}   How many times this actor has already used this ability this combat (0 if
 *   never, outside combat, or if the stored count is stale).
 */
export function getUsesThisEncounter(actor, flagKey) {
  if (!game.combat) {
    return 0;
  }

  const record = actor.getFlag?.('essence20', flagKey);
  if (!record || record.combatId != game.combat.id) {
    return 0;
  }

  return record.count ?? 0;
}

/**
 * Records that an actor just used a widened once-per-combat ability - see getUsesThisEncounter().
 * No-ops outside of combat, same reasoning as markUsedThisEncounter().
 * @param {Actor} actor
 * @param {String} flagKey
 */
export async function markUsedThisEncounterCount(actor, flagKey) {
  if (!game.combat) {
    return;
  }

  await actor.setFlag('essence20', flagKey, {
    combatId: game.combat.id,
    count: getUsesThisEncounter(actor, flagKey) + 1,
  });
}

/**
 * A "once per scene" tracker keyed on the current Scene rather than the current Combat (unlike
 * hasUsedThisEncounter/markUsedThisEncounter above) - correct for a RAW "once per scene" ability
 * that's just as usable outside combat (e.g. Hawk's Personnel Files "Dependable": "Once per
 * scene, before you roll a Skill Test...") as during it, where hasUsedThisEncounter's own combat-
 * only gate would incorrectly disable the ability entirely outside an active Combat encounter.
 * Counts uses rather than a plain boolean, so a grant that can widen its own per-scene cap (e.g.
 * Legendary Dependability widening Dependable from once to twice) can share this same helper.
 * @param {Actor} actor
 * @param {String} flagKey   A distinct flag name per ability, e.g. "dependableUsesThisScene".
 * @returns {Number}   How many times this actor has already used this ability this scene (0 if
 *   never, or if the stored count is stale - stamped with a Scene id other than the current one).
 */
export function getUsesThisScene(actor, flagKey) {
  const sceneId = game.scenes?.current?.id ?? null;
  const record = actor.getFlag?.('essence20', flagKey);
  if (!record || record.sceneId !== sceneId) {
    return 0;
  }

  return record.count ?? 0;
}

/**
 * Records that an actor just used a once-per-scene ability - see getUsesThisScene(). Increments
 * (rather than overwrites) so a single Perk that consumes more than one "charge" at a time (e.g.
 * Old Reliable's own "spend an additional Moxie to treat BOTH d20 results as a 10") can pass a
 * larger count in one call.
 * @param {Actor} actor
 * @param {String} flagKey
 * @param {Number} count   How many uses to record at once. Defaults to 1.
 */
export async function markUsedThisScene(actor, flagKey, count = 1) {
  const sceneId = game.scenes?.current?.id ?? null;
  const current = getUsesThisScene(actor, flagKey);
  await actor.setFlag('essence20', flagKey, { sceneId, count: current + count });
}

/**
 * A one-shot bonus banked NOW for a Skill Test the actor (or an ally they chose) hasn't rolled
 * yet - e.g. Think On It ("grant yourself an Edge on one Skill Test before the beginning of your
 * next turn") or Plan of Action (the same idea, granted to an ally instead of yourself). Unlike
 * hasUsedThisRound/ThisTurn/ThisEncounter above (which gate whether an ABILITY can trigger
 * again), this stores the bonus ITSELF, to be read back and cleared the next time a matching roll
 * happens - see getPendingBonus()/clearPendingBonus() below, and helpers/banked-buffs.mjs for the
 * Perk-specific registry that decides which flagKey means what.
 *
 * No active "expires at the start of your next turn" enforcement - this system has no per-actor
 * turn-order lookup wired in anywhere a bank/consume check like this runs, so the bonus simply
 * waits until it's actually spent, a documented simplification (the same kind of accepted gap as
 * several other "until X" clauses already left unenforced elsewhere in this codebase). It IS
 * still round-stamped so a leftover bonus from a finished encounter never bleeds into a new one -
 * see getPendingBonus()'s own combatId check.
 * @param {Actor} actor   Whoever the bonus is banked ON - the granter for a self Perk, or the
 *   chosen ally for a Perk that targets someone else.
 * @param {String} flagKey   A distinct flag name per ability, e.g. "pendingThinkOnIt".
 * @param {Object} data   Whatever the consuming check needs, e.g. { edge: true } or
 *   { shiftUp: 2 } - merged with the same {combatId, round} stamp bankPendingBonus's siblings use.
 */
export async function bankPendingBonus(actor, flagKey, data = {}) {
  await actor.setFlag('essence20', flagKey, {
    ...data,
    combatId: game.combat?.id ?? null,
    round: game.combat?.round ?? null,
  });
}

/**
 * Reads back a bonus banked by bankPendingBonus(), or null if there isn't one - either because
 * none was ever banked, or because it's stale (stamped with a combatId from a combat that's since
 * ended - a brand new encounter starting is the one thing that silently clears it, same
 * "combatId, not round, is what makes a flag stale" reasoning as hasUsedThisEncounter above).
 * Banked outside of combat (combatId/round both null) never goes stale this way, matching every
 * other flag helper's own "no combat, no round to gate on" precedent.
 * @param {Actor} actor
 * @param {String} flagKey
 * @returns {Object|null}
 */
export function getPendingBonus(actor, flagKey) {
  const pending = actor.getFlag?.('essence20', flagKey);
  if (!pending) {
    return null;
  }

  if (pending.combatId && (!game.combat || pending.combatId != game.combat.id)) {
    return null;
  }

  return pending;
}

/**
 * Clears a banked bonus once it's been spent - see bankPendingBonus()/getPendingBonus() above.
 * @param {Actor} actor
 * @param {String} flagKey
 */
export async function clearPendingBonus(actor, flagKey) {
  await actor.unsetFlag('essence20', flagKey);
}

/**
 * Posts a plain chat card confirming a Perk's "Use" click actually took effect - a persistent
 * record in the log, visible to the GM and every player, rather than a ui.notifications toast only
 * the clicking user sees (and can easily miss, e.g. when an ally-targeted Perk silently no-ops
 * because there was nobody eligible to target - the toast was the only feedback either way). Every
 * "it worked" branch in helpers/banked-buffs.mjs#onPerkUse and
 * helpers/team-buffs.mjs#onTeamBuffPerkUse posts through here now instead of calling
 * ui.notifications.info directly; the "you can't do that" warnings in those same files stay plain
 * toasts, since those are transient feedback for the clicking player only, not a record of
 * something that happened.
 * @param {Actor} actor   Whoever used the Perk - the chat card's speaker.
 * @param {String} content   Plain text (or a small HTML fragment) for the card's own body.
 */
export function postPerkUseChatCard(actor, content) {
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
  });
}
