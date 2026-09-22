import { getGameLine } from "../settings.js";

/**
 * The primary Party ("Squad") and the guarantees around it.
 *
 * The world's shared Story Point pool lives on ONE Party actor - the one pinned as primary
 * (essence20.primaryParty, read through Essence20Actors#party) - because an Actor is something
 * a player can be given permission on, and a world setting is not. That only works if a primary
 * Party always exists, which is what this module keeps true:
 *
 *  - a world with no Party gets one the first time a GM connects, and the primary is made at
 *    least visible to players (ensurePrimaryParty);
 *  - the last Party cannot be deleted, and only a GM can delete the primary
 *    (Essence20Actor#_preDelete asks preventLastPartyDelete and preventPrimaryDeleteByPlayer);
 *  - a GM deleting the primary hands the pin, and the points, to the next Party (handlePartyDeleted).
 *
 * The pure decisions - which Party is next, what a new one is called, what the one-time move
 * of the old settings looks like - are separate functions with no Foundry in them, so they are
 * testable. The three entry points above do the Foundry work around them.
 */

/** The world settings the pool lived in before it moved onto the Party. Read once, then zeroed. */
const LEGACY_SETTINGS = { storyPoints: "sptStoryPoints", gmPoints: "sptGmPoints" };

/**
 * Every Party in the world, in sidebar order.
 * @returns {Actor[]}
 */
export function allParties() {
  return game.actors.filter(actor => actor.type == 'party').sort((a, b) => a.sort - b.sort);
}

/**
 * The Party that should be primary once `excludedId` is gone.
 *
 * The one already pinned if it is still there and is not the one going; otherwise the first of
 * the rest in sidebar order, which is the one the GM sees at the top of the list and so the
 * least surprising choice.
 * @param {Array<{id: string}>} parties   In sidebar order.
 * @param {string} pinnedId   The current primary's id, or "".
 * @param {?string} [excludedId]   A Party being deleted.
 * @returns {?Object} The Party to pin, or null if there are none left.
 */
export function pickPrimary(parties, pinnedId, excludedId = null) {
  const remaining = (parties ?? []).filter(party => party.id !== excludedId);
  return remaining.find(party => party.id === pinnedId) ?? remaining[0] ?? null;
}

/**
 * What a Party made automatically is called: the game line's own word for a squad where one is
 * set ("Strike Team", "Friend Group"), and the plain type name otherwise.
 * @param {string} line   From getGameLine().
 * @returns {string}
 */
export function defaultPartyName(line) {
  if (line) {
    return game.i18n.localize(`E20.PartyName${line.capitalize()}`);
  }

  return game.i18n.localize("TYPES.Actor.party");
}

/**
 * The update that carries the points off one Party and onto another.
 *
 * Added rather than copied: a GM who has already given the new primary a few points of its own
 * should not lose them, and a pool of zero adds nothing.
 * @param {{system: {storyPoints: number, gmPoints: number}}} from
 * @param {{system: {storyPoints: number, gmPoints: number}}} to
 * @returns {?Object} Update data for `to`, or null if there is nothing to carry.
 */
export function carriedPoints(from, to) {
  const story = from?.system?.storyPoints ?? 0;
  const gm = from?.system?.gmPoints ?? 0;
  if (!story && !gm) {
    return null;
  }

  return {
    "system.storyPoints": (to?.system?.storyPoints ?? 0) + story,
    "system.gmPoints": (to?.system?.gmPoints ?? 0) + gm,
  };
}

/**
 * The ownership change a primary Party needs so that players can see it, if any.
 *
 * A document a player has no permission on is never sent to their client, so a primary Party
 * left at the default of None means every player's tracker reads an empty pool and no Perk
 * that costs a Story Point can ever be offered to them. Observer is the least that lets them
 * see it; anything the GM set higher is left exactly as it is.
 * @param {{ownership: {default: number}}} party
 * @returns {?Object} Update data, or null when nothing needs to change.
 */
export function visibleToPlayers(party) {
  const current = party?.ownership?.default ?? CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;
  if (current > CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE) {
    return null;
  }

  return { "ownership.default": CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER };
}

/**
 * Make sure a primary Party exists, and move the old settings' points onto it once.
 *
 * Run by the GM at ready. Three things can be wrong with a world and each is put right on its
 * own: no Party at all (a new world, or one from before the Party actor existed); Parties but no
 * valid pin (the pinned one was deleted while no GM was connected to reassign it); and points
 * still sitting in the world settings from before they lived here.
 * @returns {Promise<?Actor>} The primary Party.
 */
export async function ensurePrimaryParty() {
  if (!game.user.isGM) {
    return game.actors.party;
  }

  let party = game.actors.party;
  if (!party) {
    party = pickPrimary(allParties(), game.settings.get("essence20", "primaryParty"));
  }

  if (!party) {
    party = await Actor.create({
      name: defaultPartyName(getGameLine()),
      type: "party",
      // Players can see the pool from the start; the GM raises this to Owner for anyone who
      // should be able to spend from it without asking.
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
    });
  }

  if (party && party.id !== game.settings.get("essence20", "primaryParty")) {
    await game.settings.set("essence20", "primaryParty", party.id);
  }

  const ownership = visibleToPlayers(party);
  if (ownership) {
    await party.update(ownership);
  }

  await migrateLegacyPoints(party);
  return party;
}

/**
 * Move the points out of the world settings and onto the Party, once.
 *
 * Nothing marks the migration as done: the settings are zeroed after the move, and a zero is
 * nothing to move, so running this again is a no-op by construction.
 * @param {Actor} party
 */
async function migrateLegacyPoints(party) {
  const legacy = {
    system: {
      storyPoints: game.settings.get("essence20", LEGACY_SETTINGS.storyPoints) ?? 0,
      gmPoints: game.settings.get("essence20", LEGACY_SETTINGS.gmPoints) ?? 0,
    },
  };

  const update = carriedPoints(legacy, party);
  if (!update || !party) {
    return;
  }

  await party.update(update);
  await game.settings.set("essence20", LEGACY_SETTINGS.storyPoints, 0);
  await game.settings.set("essence20", LEGACY_SETTINGS.gmPoints, 0);
  console.info(`essence20 | Story Points moved from the world settings onto "${party.name}".`);
}

/**
 * Whether deleting this Party would leave the world without one.
 *
 * Called from Essence20Actor#_preDelete on the deleting client, which is the only place a
 * deletion can still be refused. The pool has to live somewhere, so the last Party stays.
 * @param {Actor} party
 * @returns {boolean} True when the deletion must be refused.
 */
export function preventLastPartyDelete(party) {
  if (party.type != 'party' || allParties().length > 1) {
    return false;
  }

  ui.notifications.warn(game.i18n.localize("E20.PartyCannotDeleteLast"));
  return true;
}

/**
 * Whether a player is trying to delete the primary Party.
 *
 * A player who owns the primary could otherwise delete it - and the pin it carries is a world
 * setting only a GM can rewrite, so with no GM connected the points would simply be gone. The
 * primary is the GM's to retire. Other Parties a player owns are still theirs to delete.
 * @param {Actor} party
 * @returns {boolean} True when the deletion must be refused.
 */
export function preventPrimaryDeleteByPlayer(party) {
  if (party.type != 'party' || game.user.isGM
    || party.id !== game.settings.get("essence20", "primaryParty")) {
    return false;
  }

  ui.notifications.warn(game.i18n.localize("E20.PartyCannotDeletePrimary"));
  return true;
}

/**
 * After a Party is deleted: if it was the primary, pin the next one and carry the points over.
 *
 * Runs on every client from Essence20Actor#_onDelete, but only the active GM acts. Since only a
 * GM can delete the primary (preventPrimaryDeleteByPlayer), a GM is always connected when this
 * matters - the deleting one at least - so nothing is ever left for ensurePrimaryParty() to
 * repair, and no points are lost.
 * @param {Actor} deleted   The Party that has just gone. Its data is still readable.
 */
export async function handlePartyDeleted(deleted) {
  if (deleted.type != 'party' || game.users.activeGM?.id !== game.user.id) {
    return;
  }

  const pinnedId = game.settings.get("essence20", "primaryParty");
  if (pinnedId !== deleted.id) {
    return;
  }

  const next = pickPrimary(allParties(), pinnedId, deleted.id);
  if (!next) {
    return;
  }

  const update = carriedPoints(deleted, next);
  if (update) {
    await next.update(update);
  }

  await game.settings.set("essence20", "primaryParty", next.id);
  ui.notifications.info(game.i18n.format("E20.PartyPrimaryReassigned", { name: next.name }));
}
