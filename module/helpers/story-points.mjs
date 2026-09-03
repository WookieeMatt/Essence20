/**
 * PC-triggered Story Point spending (GI Joe CRB "In My Sights"), over game.socket.
 *
 * sptStoryPoints (module/settings.js) is a scope:"world" Foundry setting - writable only by a
 * GM, a Foundry permission rule this codebase doesn't control (see apps/story-points.mjs's own
 * GM-only setStoryPoints()). A player's own client can't perform that write directly; instead
 * it asks whichever GM client is currently connected to perform it, over the same
 * "system.essence20" socket channel the Story Points tracker already uses to sync GM-made
 * changes out to players (see essence20.mjs's listener, which now also dispatches to
 * handleStoryPointSpendRequest below by checking the message's own `action` field). This is
 * fire-and-forget - the requesting client doesn't wait for a reply, it just checks
 * isGmConnected()/hasStoryPointsAvailable() first for an honest upfront message. If nobody with
 * GM permissions is currently connected, nobody CAN perform the write at all; that's an inherent
 * limit of a world-scoped setting, not something this file can work around. Moving the shared
 * pool onto a Document players have real update permission on (instead of a Setting) would lift
 * that limit, at the cost of migrating the existing, currently-working Story Points tracker onto
 * new storage - a bigger, separate project, not bundled in here.
 */

const STORY_POINTS_SETTING = "sptStoryPoints";

export function isGmConnected() {
  return game.users.some(user => user.isGM && user.active);
}

export function hasStoryPointsAvailable(amount = 1) {
  return (game.settings.get("essence20", STORY_POINTS_SETTING) ?? 0) >= amount;
}

/**
 * Fires a spend request at whichever GM client is currently connected. Callers should gate on
 * isGmConnected()/hasStoryPointsAvailable() first (see helpers/reroll.mjs#hasRerollCost) for a
 * clear message before committing to anything - this itself doesn't confirm the spend actually
 * happened, since Foundry's socket layer here isn't a request/response channel.
 * @param {Actor} actor   The actor spending the point, for the GM-side chat announcement.
 * @param {Number} [amount]
 */
export function requestStoryPointSpend(actor, amount = 1) {
  game.socket.emit("system.essence20", {
    action: "spendStoryPoints",
    amount,
    actorName: actor?.name,
  });
}

/**
 * The GM-side handler for a spend request - called from essence20.mjs's own socket listener.
 * A no-op on any client that isn't actually the GM (matches every other GM-only write in this
 * codebase, e.g. apps/story-points.mjs#setStoryPoints's own isGM guard) - if more than one GM is
 * connected, each independently attempts the spend, so a race is possible; that mirrors how two
 * GMs could just as easily both reach for the physical Story Points tracker at once today.
 * @param {Object} data   {action: "spendStoryPoints", amount, actorName}
 */
export function handleStoryPointSpendRequest(data) {
  if (!game.user.isGM) {
    return;
  }

  const amount = Number(data.amount) || 1;
  const current = game.settings.get("essence20", STORY_POINTS_SETTING) ?? 0;
  if (current < amount) {
    ui.notifications.warn(game.i18n.format("E20.SptSpendRequestDenied", { actorName: data.actorName ?? "?" }));
    return;
  }

  const next = current - amount;
  game.settings.set("essence20", STORY_POINTS_SETTING, next);

  // Keeps the GM's own tracker window in sync if it's currently open, and broadcasts the new
  // total to every other connected client's tracker - reusing the exact payload shape
  // apps/story-points.mjs#updateClients()/handleStoryPointSignal() already expect (this emit
  // doesn't loop back to this same client, matching that method's own local-then-broadcast
  // pattern).
  if (game.StoryPointsTracker) {
    game.StoryPointsTracker._storyPoints = next;
    game.StoryPointsTracker.render(false);
  }

  game.socket.emit("system.essence20", {
    gmPoints: game.settings.get("essence20", "sptGmPoints") ?? 0,
    storyPoints: next,
  });

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ user: game.user.id }),
    content: game.i18n.format("E20.SptSpendRequestGranted", { actorName: data.actorName ?? "?" }),
  });
}
