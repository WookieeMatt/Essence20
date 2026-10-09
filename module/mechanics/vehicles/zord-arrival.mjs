/**
 * Call to Action's arrival (PR CRB p.135): "In 3d2 game rounds, the Zord arrives to the border of the conflict, awaiting to
 * be piloted by the Ranger that summoned it. Once the Ranger comes into contact with the Zord, they are placed in a
 * driver's position and they begin to use the Zord's stats for vehicular combat immediately."
 *
 * zord-summon.mjs rolls the timer (flags.essence20.zordSummonReadyRound) and notes who called it (zordSummoner). Here:
 *  1. At the start of the round it names, the Zord has arrived (flags.essence20.zordArrived, for that combat): a chat card
 *     says so, and the Ranger's Zords tab shows it as Arrived instead of offering to summon it again.
 *  2. The card's Place button (a GM) puts the Zord's token on the map at the scene's edge nearest its Ranger.
 *  3. Board (the card, or the Zords tab) seats the Ranger as its driver - once their tokens touch, or straight away
 *     when either isn't on the map (the GM's call then).
 */
import { registerChatButton, registerRoundStart } from "../item-hooks.mjs";

export const SUMMONER_FLAG = 'zordSummoner';
export const ARRIVED_FLAG = 'zordArrived';
const READY_FLAG = 'zordSummonReadyRound';

const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

/** Whether the Zord has arrived in this combat. */
export function hasArrived(zord, combat = globalThis.game?.combat) {
  const arrived = zord?.flags?.essence20?.[ARRIVED_FLAG];
  return !!(arrived && combat && arrived.combatId == combat.id);
}

/** The Zords whose timer is up this round and haven't arrived yet. Exported for tests. */
export function arrivingZords(actors, combat) {
  return actors.filter(actor => actor?.type == 'zord' && !hasArrived(actor, combat)
    && Number.isFinite(Number(actor.flags?.essence20?.[READY_FLAG]))
    && Number(actor.flags.essence20[READY_FLAG]) <= combat.round);
}

/** The Ranger who called the Zord: the one noted at the summon, else the first character listing it. */
export function rangerOf(zord) {
  const noted = zord?.flags?.essence20?.[SUMMONER_FLAG];
  const actor = noted ? globalThis.fromUuidSync?.(noted, { strict: false }) : null;
  return actor ?? [...(globalThis.game?.actors ?? [])].find(other => ['playerCharacter', 'npc'].includes(other.type)
    && Object.values(other.system?.actors ?? {}).some(entry => entry?.uuid == zord?.uuid)) ?? null;
}

async function postArrival(zord) {
  const ranger = rangerOf(zord);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: zord }),
    content: `<p>${T('ZordArrived', { name: zord.name, ranger: ranger?.name ?? T('ZordArrivedNoRanger') })}</p>`
      + `<button type="button" data-e20-ext="zordPlace" data-zord="${zord.uuid}"><i class="fas fa-location-dot"></i> ${T('ZordPlace')}</button>`
      + `<button type="button" data-e20-ext="zordBoard" data-zord="${zord.uuid}"><i class="fas fa-person-walking-arrow-right"></i> ${T('ZordBoard')}</button>`,
  });
}

/** Round start (the active GM): every Zord whose timer is up arrives. */
export async function announceArrivals(combat) {
  if (!globalThis.game?.users?.activeGM?.isSelf || !combat?.started) {
    return;
  }

  for (const zord of arrivingZords([...(game.actors ?? [])], combat)) {
    await zord.setFlag('essence20', ARRIVED_FLAG, { combatId: combat.id, round: combat.round });
    await postArrival(zord);
  }
}

/**
 * Where on the map the Zord turns up: the scene's edge nearest its Ranger's token (the scene's middle edge with no
 * Ranger on it), snapped to the grid, inside the scene. Exported for tests.
 * @param {{x, y, width, height}} rect   The scene's area (canvas.dimensions.sceneRect)
 * @param {{x, y}|null} near             The Ranger token's centre
 * @param {Number} w   Token width (px)
 * @param {Number} h   Token height (px)
 * @param {Number} size   Grid size (px)
 */
export function edgePosition(rect, near, w, h, size = 100) {
  const point = near ?? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const edges = {
    left: point.x - rect.x,
    right: rect.x + rect.width - point.x,
    top: point.y - rect.y,
    bottom: rect.y + rect.height - point.y,
  };
  const edge = Object.entries(edges).sort((a, b) => a[1] - b[1])[0][0];
  const clampX = x => Math.min(Math.max(x, rect.x), rect.x + rect.width - w);
  const clampY = y => Math.min(Math.max(y, rect.y), rect.y + rect.height - h);
  const snap = value => Math.round(value / size) * size;
  const along = { x: clampX(snap(point.x - w / 2)), y: clampY(snap(point.y - h / 2)) };
  switch (edge) {
  case 'left': return { x: rect.x, y: along.y };
  case 'right': return { x: rect.x + rect.width - w, y: along.y };
  case 'top': return { x: along.x, y: rect.y };
  default: return { x: along.x, y: rect.y + rect.height - h };
  }
}

/** Put the Zord's token on the map at the edge nearest its Ranger. */
export async function placeZord(zord) {
  const scene = canvas?.scene;
  if (!scene || !zord) {
    return false;
  }

  if (!game.user.isGM && !game.user.can?.('TOKEN_CREATE')) {
    ui.notifications.warn(T('ZordPlaceNeedsGm'));
    return false;
  }

  if (zord.getActiveTokens?.(false, true)?.some(token => token.parent == scene)) {
    ui.notifications.warn(T('ZordAlreadyOnMap', { name: zord.name }));
    return false;
  }

  const size = canvas.grid?.size ?? 100;
  const data = (await zord.getTokenDocument()).toObject();
  const w = (Number(data.width) || 1) * size;
  const h = (Number(data.height) || 1) * size;
  const rangerToken = rangerOf(zord)?.getActiveTokens?.(false, true)?.find(token => token.parent == scene)?.object ?? null;
  const position = edgePosition(canvas.dimensions.sceneRect, rangerToken?.center ?? null, w, h, size);
  await scene.createEmbeddedDocuments('Token', [{ ...data, ...position }]);
  return true;
}

/** Whether two tokens touch (edge to edge, diagonals included), measured as zord2's merge Reach is. */
export function tokensTouch(a, b, grid = canvas?.grid) {
  const size = grid?.size || 100;
  const gapX = Math.max(0, Math.abs(a.center.x - b.center.x) - (a.w + b.w) / 2);
  const gapY = Math.max(0, Math.abs(a.center.y - b.center.y) - (a.h + b.h) / 2);
  return Math.max(gapX, gapY) < size / 2;
}

/**
 * Seat the Ranger as the Zord's driver (PR CRB p.135) once they come into contact. Without both tokens on the map,
 * contact isn't checked - the table's call.
 */
export async function boardZord(zord, ranger = rangerOf(zord)) {
  if (!zord || !ranger) {
    ui.notifications.warn(T('ZordBoardNoRanger', { name: zord?.name ?? '' }));
    return false;
  }

  const scene = canvas?.scene;
  const find = actor => actor.getActiveTokens?.()?.find(token => token.document?.parent == scene) ?? null;
  const zordToken = scene ? find(zord) : null;
  const rangerToken = scene ? find(ranger) : null;
  if (zordToken && rangerToken && !tokensTouch(zordToken, rangerToken)) {
    ui.notifications.warn(T('ZordBoardNotTouching', { ranger: ranger.name, name: zord.name }));
    return false;
  }

  const entries = Object.entries(zord.system?.actors ?? {});
  const [key, entry] = entries.find(([, e]) => e?.uuid == ranger.uuid) ?? [];
  // Still in the driver's seat from an earlier fight (the seat outlives the combat): they climb back in - only the
  // token leaves the map.
  const seated = entry?.vehicleRole == 'driver';
  const drivers = entries.filter(([, e]) => e?.vehicleRole == 'driver').length;
  if (!seated && drivers >= (Number(zord.system?.crew?.numDrivers) || 1)) {
    ui.notifications.warn(T('ZordBoardSeatTaken', { name: zord.name }));
    return false;
  }

  if (seated) {
    // Already the driver: nothing to write.
  } else if (key) {
    await zord.update({ [`system.actors.${key}.vehicleRole`]: 'driver' });
  } else {
    const { setEntryAndAddActor } = await import("../../sheet-handlers/drop-handler.mjs");
    await setEntryAndAddActor(ranger, zord, 'driver');
  }

  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: ranger }), content: `<p>${T('ZordBoarded', { ranger: ranger.name, name: zord.name })}</p>` });

  // Inside the Zord now: the Ranger's token leaves the map. Not an unlinked token's copy - that copy lives in the token,
  // and the Zord's seat points at it.
  if (rangerToken && !ranger.isToken && rangerToken.document?.isOwner) {
    await rangerToken.document.delete();
  }

  return true;
}

registerRoundStart(announceArrivals);

registerChatButton('zordPlace', async (message, button) => {
  await placeZord(await fromUuid(button.dataset.zord));
});

registerChatButton('zordBoard', async (message, button) => {
  await boardZord(await fromUuid(button.dataset.zord));
});

// The Ranger's sheet shows the Zord's summon state (Arrives at round N / Arrived / its driver seat): when a Zord's summon,
// arrival or seats change, every open sheet of a character listing it is drawn again, on every client.
const SUMMON_KEYS = [READY_FLAG, ARRIVED_FLAG, SUMMONER_FLAG, 'zordRecalled'];
if (typeof Hooks != 'undefined') {
  Hooks.on('updateActor', (actor, changes) => {
    const flags = changes?.flags?.essence20 ?? {};
    const touched = SUMMON_KEYS.some(key => key in flags || `-=${key}` in flags) || changes?.system?.actors !== undefined;
    if (actor?.type != 'zord' || !touched) {
      return;
    }

    for (const app of foundry.applications.instances.values()) {
      const doc = app.document;
      if (app.rendered && doc?.documentName == 'Actor' && doc !== actor
        && Object.values(doc.system?.actors ?? {}).some(entry => entry?.uuid == actor.uuid)) {
        app.render();
      }
    }
  });
}

// The combat is over: a Zord on its way, or arrived, isn't any more - its summon timer, arrival and caller are cleared
// (the active GM, for every Zord that combat touched), so the Zords tab offers Summon again.
if (typeof Hooks != 'undefined') {
  Hooks.on('deleteCombat', async combat => {
    if (!game.users?.activeGM?.isSelf) {
      return;
    }

    for (const zord of game.actors?.filter?.(actor => actor.type == 'zord') ?? []) {
      const flags = zord.flags?.essence20 ?? {};
      const arrivedHere = flags[ARRIVED_FLAG]?.combatId == combat.id;
      if (arrivedHere || flags[READY_FLAG] !== undefined) {
        await zord.update(clearSummonUpdate(flags));
      }
    }
  });
}

/** The update that clears a Zord's summon state (only the keys it has). Exported for tests. */
export function clearSummonUpdate(flags = {}) {
  return Object.fromEntries([READY_FLAG, ARRIVED_FLAG, SUMMONER_FLAG].filter(key => flags[key] !== undefined)
    .map(key => [`flags.essence20.${key}`, new foundry.data.operators.ForcedDeletion()]));
}
