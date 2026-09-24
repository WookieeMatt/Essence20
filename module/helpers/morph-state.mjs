/**
 * Making a Morphed Ranger or a transformed Cybertronian *look* morphed or transformed.
 *
 * Before this the only signs of either state were the sheet button's label flipping and a token
 * image swap that silently did nothing when no Morphed / Alt Mode art had been set. Everything
 * here hangs off the two booleans the rest of the system already reads - `system.isMorphed` and
 * `system.isTransformed` - and is driven from `Essence20Actor#_onUpdate`, so it fires no matter
 * which path flipped them: the sheet buttons (sheet-handlers/power-ranger-handler.mjs#onMorph,
 * sheet-handlers/transformer-handler.mjs), the Token Action HUD helpers on the document, or a
 * Perk that toggles the flag directly (helpers/its-time.mjs).
 *
 * Three signals, each a thin layer over something Foundry already provides:
 *
 *  1. A **status effect** (`morphed` / `altMode`, registered in helpers/config.mjs) - which puts an
 *     icon on the token, a row in the Combat Tracker and the sheet's Effects tab, and gives macros
 *     `actor.statuses.has("morphed")`. The Alt Mode one takes the Alt Mode item's own name and
 *     token image, so "Ground Vehicle Mode" and "Aerial Mode" read differently at a glance.
 *  2. A **badge** in the sheet header (templates/actor/headers/common.hbs) - the template reads the
 *     flags itself; this file only supplies nothing for it, it is listed here for completeness.
 *  3. A **chat line** ("Jason morphs!", "Bumblebee transforms into Ground Vehicle Mode!").
 *
 * A token ring tint in the character's colour was built and taken out again the same day
 * (2026-09-22): the dynamic ring only fits square tokens, and this system has 1x2 and 2x3 ones.
 *
 * Only the client that made the update acts (the `userId` check), since every one of these is a
 * document write of its own and would otherwise be repeated once per connected client.
 */

export const MORPHED_STATUS = "morphed";
export const ALT_MODE_STATUS = "altMode";

/**
 * Which state transitions an actor update describes.
 *
 * `altMode` is also reported when a transformed actor switches straight from one Alt Mode to
 * another (`altModeId` changes while `isTransformed` stays true), which is the multi-mode dialog's
 * path - the status and the chat line should follow the new mode.
 *
 * @param {Object} changed   The differential update, as `_onUpdate` receives it.
 * @param {Actor} actor      The actor, already carrying the new values.
 * @returns {{morphed?: boolean, altMode?: {active: boolean, name: string|null}}}
 */
export function morphTransitions(changed, actor) {
  const { hasProperty, getProperty } = foundry.utils;
  const out = {};

  if (hasProperty(changed, "system.isMorphed")) {
    out.morphed = !!getProperty(changed, "system.isMorphed");
  }

  const transformedChanged = hasProperty(changed, "system.isTransformed");
  const modeChanged = hasProperty(changed, "system.altModeId");
  if (transformedChanged || (modeChanged && actor.system?.isTransformed)) {
    const active = transformedChanged ? !!getProperty(changed, "system.isTransformed") : true;
    const altModeId = modeChanged ? getProperty(changed, "system.altModeId") : actor.system?.altModeId;
    const altMode = active && altModeId ? actor.items?.get?.(altModeId) : null;
    out.altMode = { active, name: altMode?.name ?? null, img: altMode?.system?.tokenImage || altMode?.img || null };
  }

  return out;
}

/**
 * The chat lines a set of transitions calls for, as i18n keys plus format data.
 * @param {ReturnType<typeof morphTransitions>} transitions
 * @param {Actor} actor
 * @returns {Array<{key: string, data: Object}>}
 */
export function announcementsFor(transitions, actor) {
  const name = actor?.name ?? "";
  const lines = [];

  if (transitions.morphed !== undefined) {
    lines.push({ key: transitions.morphed ? "E20.MorphAnnounceOn" : "E20.MorphAnnounceOff", data: { name } });
  }

  if (transitions.altMode) {
    const { active, name: mode } = transitions.altMode;
    lines.push(active
      ? { key: "E20.TransformAnnounceOn", data: { name, mode: mode ?? game.i18n.localize("E20.StatusAltMode") } }
      : { key: "E20.TransformAnnounceOff", data: { name } });
  }

  return lines;
}

/**
 * Put every visual in line with the actor's Morphed / Alt Mode state after an update flipped it.
 *
 * @param {Actor} actor
 * @param {Object} changed   The differential update.
 * @param {Object} options   The update options; `essence20.silentState` suppresses the chat line
 *   (a Perk that only borrows the Morphed benefits announces itself in its own words).
 * @param {string} userId    The user who made the update.
 * @returns {Promise<void>}
 */
export async function syncMorphState(actor, changed, options, userId) {
  if (!game.user || userId !== game.user.id) return;

  const transitions = morphTransitions(changed, actor);
  if (transitions.morphed === undefined && !transitions.altMode) return;

  await syncStatuses(actor, transitions);

  if (!options?.essence20?.silentState) {
    await announce(actor, transitions);
  }
}

/**
 * Add or remove the status effects the transitions call for.
 * @param {Actor} actor
 * @param {ReturnType<typeof morphTransitions>} transitions
 * @returns {Promise<void>}
 */
async function syncStatuses(actor, transitions) {
  if (transitions.morphed !== undefined) {
    await setStatus(actor, MORPHED_STATUS, transitions.morphed);
  }

  if (transitions.altMode) {
    const { active, name, img } = transitions.altMode;
    await setStatus(actor, ALT_MODE_STATUS, active, { name, img });
  }
}

/**
 * Ensure exactly one effect for a status is present (or none), optionally dressed in a name and
 * image of its own - the Alt Mode status wears the Alt Mode's.
 * @param {Actor} actor
 * @param {string} statusId
 * @param {boolean} active
 * @param {{name?: string|null, img?: string|null}} [dress]
 * @returns {Promise<void>}
 */
async function setStatus(actor, statusId, active, { name = null, img = null } = {}) {
  const existing = (actor.effects?.contents ?? [...(actor.effects ?? [])]).filter(e => e.statuses?.has?.(statusId));

  if (!active) {
    if (existing.length) await actor.deleteEmbeddedDocuments("ActiveEffect", existing.map(e => e.id));
    return;
  }

  const dress = { ...(name ? { name } : {}), ...(img ? { img } : {}) };
  if (existing.length) {
    if (Object.keys(dress).length) await existing[0].update(dress);
    return;
  }

  const effect = await actor.toggleStatusEffect(statusId, { active: true });
  if (effect && typeof effect === "object" && Object.keys(dress).length) {
    await effect.update(dress);
  }
}

/**
 * Post the chat line(s) for the transitions.
 * @param {Actor} actor
 * @param {ReturnType<typeof morphTransitions>} transitions
 * @returns {Promise<void>}
 */
async function announce(actor, transitions) {
  for (const { key, data } of announcementsFor(transitions, actor)) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p>${game.i18n.format(key, data)}</p>`,
    });
  }
}

/**
 * Tell the user when a state change is about to swap token art that was never set up - the one
 * case where "nothing happened" used to be silent. Called by the morph/transform handlers
 * before they change the image.
 * @param {Actor} actor
 * @param {"morph"|"altMode"} kind
 * @param {Item} [altMode]   The Alt Mode being entered, for `altMode`.
 * @returns {boolean}   Whether a warning was shown.
 */
export function warnMissingStateImage(actor, kind, altMode = null) {
  if (kind === "morph" && !actor?.system?.image?.morphed) {
    ui.notifications.info(game.i18n.format("E20.MorphNoImage", { name: actor?.name ?? "" }));
    return true;
  }

  if (kind === "altMode" && altMode && !altMode.system?.tokenImage) {
    ui.notifications.info(game.i18n.format("E20.AltModeNoImage", { name: actor?.name ?? "", mode: altMode.name ?? "" }));
    return true;
  }

  return false;
}
