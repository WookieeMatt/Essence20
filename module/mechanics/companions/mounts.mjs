import { ridePosition, tokenAt, tokenOf, tokensAdjacent } from "../vehicles/alt-mode-crew.mjs";
import { sizeClassIndex } from "../combat/size-classes.mjs";
import { announce } from "../world/public-hooks.mjs";
import { worldActors } from "./companion-link.mjs";

/**
 * Homebrew: riding a creature - Battle Cat, a Dino-Rider's dinosaur, a horse. A companion or NPC with "Can be ridden"
 * (Sheet Options; system.mount {rideable, riders}) carries up to `riders` riders, each a Size Class smaller than it.
 * The mount moves; the rider acts. Getting on or off is a Move action in a fight.
 *
 * Kept apart from a Transformer's Alt Mode crew (mechanics/vehicles/alt-mode-crew.mjs), whose token helpers it borrows:
 * a rider sits on top, not inside, so their token stays shown - they can still be targeted and still act.
 * - The mount keeps its riders: flags.essence20.riders {<key>: {uuid, name, img, at}}.
 * - The active GM keeps the tokens in line (syncRiderTokens): a rider's token sits centred on the mount's, drawn above
 *   it, flagged flags.essence20.ridingOn; dragging it moves the mount instead; getting off puts it beside the mount.
 * - Rule tags (rules/plugins/companions/mount-tags.mjs): self:mounted, self:ridden.
 */

export const RIDERS_FLAG = 'riders';
export const RIDING_ON_FLAG = 'ridingOn';

const T = (key, data) => {
  const i18n = globalThis.game?.i18n;
  const full = `E20.Mount${key}`;
  const text = data ? i18n?.format?.(full, data) : i18n?.localize?.(full);
  return text && text != full ? text : `${key}${data ? ` ${JSON.stringify(data)}` : ''}`;
};

const sameActor = (a, b) => !!a && !!b && (a === b || (!!a.uuid && a.uuid == b.uuid));

function resolve(uuid) {
  try {
    return uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
  } catch (error) {
    return null;
  }
}

/** Whether it can be ridden. */
export const isRideable = actor => !!actor?.system?.mount?.rideable;

/** How many can ride it at once (at least one). */
export const riderLimit = actor => (isRideable(actor) ? Math.max(1, Math.trunc(Number(actor.system.mount.riders)) || 1) : 0);

/** Its rider rows, first on first: [{key, uuid, name, img, at}]. */
export function riderEntries(mount) {
  return Object.entries(mount?.flags?.essence20?.[RIDERS_FLAG] ?? {}).filter(([, entry]) => entry?.uuid)
    .map(([key, entry]) => ({ key, ...entry }))
    .sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0));
}

/** Its riders, resolved (anyone who no longer exists is left out). */
export const ridersOf = mount => riderEntries(mount).map(entry => resolve(entry.uuid)).filter(Boolean);

/** Every mount that might be carrying someone: world actors, and unlinked tokens' own actors on the canvas. */
function candidates() {
  const list = worldActors().filter(isRideable);
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    const actor = token?.document?.actorLink === false ? token.actor : null;
    if (isRideable(actor) && !list.includes(actor)) {
      list.push(actor);
    }
  }

  return list;
}

/** What this actor rides, and their row on it - or null. */
export function mountOf(actor, actors = candidates()) {
  if (!actor?.uuid) {
    return null;
  }

  for (const mount of actors) {
    const entry = riderEntries(mount).find(row => row.uuid == actor.uuid);
    if (entry && !sameActor(mount, actor)) {
      return { mount, entry, key: entry.key };
    }
  }

  return null;
}

/**
 * Why this actor can't ride it, as a lang key (E20.Mount<key>), or null when they can. Exported for tests.
 * @param {Actor} mount
 * @param {Actor} rider
 * @param {Object} [options]
 * @param {Actor[]} [options.mounts]   where to look for what the rider already rides.
 */
export function mountRefusal(mount, rider, { mounts } = {}) {
  if (!isRideable(mount)) {
    return 'NotRideable';
  }

  if (!rider || sameActor(mount, rider)) {
    return 'NoRider';
  }

  const riding = mountOf(rider, mounts);
  if (riding) {
    return sameActor(riding.mount, mount) ? 'AlreadyRiding' : 'RidingOther';
  }

  // Ridden by someone? A mount can't carry its own rider's mount.
  if (riderEntries(rider).length) {
    return 'HasRiders';
  }

  const big = sizeClassIndex(mount.system?.size ?? 'common');
  if (big >= 0 && sizeClassIndex(rider.system?.size ?? 'common') >= big) {
    return 'TooBig';
  }

  return riderEntries(mount).length >= riderLimit(mount) ? 'Full' : null;
}

/** Whether the actor is in the running fight. */
function inFight(actor) {
  const combat = globalThis.game?.combat;
  return !!combat?.started && [...(combat.combatants ?? [])].some(combatant => sameActor(combatant.actor, actor));
}

/** A Move action, in a fight (mechanics/actions/action-economy.mjs); false when it's refused or backed out of. */
async function spendMove(rider, source) {
  if (!inFight(rider)) {
    return true;
  }

  const { spend } = await import("../actions/action-economy.mjs");
  const result = await spend(rider, 'move', { source });
  return !result?.blocked;
}

const say = (actor, text) => globalThis.ChatMessage?.create?.({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${text}</p>` });

/** Sets or clears one rider row - on the mount when this user may, through the GM otherwise. */
async function writeRider(mount, key, entry, riderUuid) {
  const user = globalThis.game?.user;
  if (user?.isGM || mount.isOwner) {
    await mount.update({ [`flags.essence20.${RIDERS_FLAG}.${key}`]: entry ?? new foundry.data.operators.ForcedDeletion() });
    return true;
  }

  const { createViaGm } = await import("../world/gm-relay.mjs");
  return !!(await createViaGm('mountRider', { actorUuid: mount.uuid, riderUuid: riderUuid ?? entry?.uuid, key, entry }));
}

/**
 * The GM's side of a relayed rider change: whoever owns the mount, or the rider getting themselves on or off.
 * Exported for gm-relay.mjs.
 */
export function relayedRiderAllowed(payload, user) {
  const mount = resolve(payload?.actorUuid);
  const rider = resolve(payload?.riderUuid);
  if (!isRideable(mount) || !rider || !user) {
    return false;
  }

  const owns = doc => user.isGM || !!doc.testUserPermission?.(user, 'OWNER');
  if (owns(mount)) {
    return true;
  }

  return owns(rider) && (!payload.entry || payload.entry.uuid == rider.uuid);
}

/** Carries out a relayed rider change (the GM). */
export async function applyRelayedRider(payload) {
  const mount = resolve(payload.actorUuid);
  await mount.update({ [`flags.essence20.${RIDERS_FLAG}.${payload.key}`]: payload.entry ?? new foundry.data.operators.ForcedDeletion() });
  return true;
}

const newKey = mount => {
  const taken = mount?.flags?.essence20?.[RIDERS_FLAG] ?? {};
  let key;
  do {
    key = globalThis.foundry?.utils?.randomID?.(8) ?? Math.random().toString(36).slice(2, 10);
  } while (taken[key]);

  return key;
};

/** Whether their tokens touch, when both are on the viewed scene (true when either isn't - the GM's call). */
function inReach(mount, rider) {
  const scene = globalThis.canvas?.scene;
  const mountToken = tokenOf(mount, scene);
  const riderToken = tokenOf(rider, scene);
  return !mountToken || !riderToken || tokensAdjacent(mountToken, riderToken, scene.grid?.size ?? 100);
}

/**
 * Get on.
 * @param {Actor} mount
 * @param {Actor} rider
 * @param {Object} [options]
 * @param {Boolean} [options.force]   No Reach check and no Move action (the GM's call).
 * @returns {Promise<Boolean>}
 */
export async function mountUp(mount, rider, { force = false } = {}) {
  const refusal = mountRefusal(mount, rider);
  if (refusal) {
    globalThis.ui?.notifications?.warn?.(T(refusal, { name: rider?.name ?? '', mount: mount?.name ?? '' }));
    return false;
  }

  if (!force) {
    if (!inReach(mount, rider)) {
      globalThis.ui?.notifications?.warn?.(T('NotInReach', { name: rider.name, mount: mount.name }));
      return false;
    }

    if (!(await spendMove(rider, T('ActionSource', { mount: mount.name })))) {
      return false;
    }
  }

  const key = newKey(mount);
  if (!(await writeRider(mount, key, { uuid: rider.uuid, name: rider.name, img: rider.img ?? null, at: Date.now() }))) {
    return false;
  }

  await say(rider, T('Mounted', { name: rider.name, mount: mount.name }));
  announce('mounted', { mount, rider });
  return true;
}

/**
 * Get off.
 * @param {Actor} mount
 * @param {Actor} rider
 * @param {Object} [options]
 * @param {Boolean} [options.force]   No Move action (the GM's call, the mount leaving).
 * @returns {Promise<Boolean>}
 */
export async function dismount(mount, rider, { force = false } = {}) {
  const entry = riderEntries(mount).find(row => row.uuid == rider?.uuid);
  if (!entry) {
    globalThis.ui?.notifications?.warn?.(T('NotRiding', { name: rider?.name ?? '', mount: mount?.name ?? '' }));
    return false;
  }

  if (!force && !(await spendMove(rider, T('DismountSource', { mount: mount.name })))) {
    return false;
  }

  if (!(await writeRider(mount, entry.key, null, rider.uuid))) {
    return false;
  }

  await say(rider, T('Dismounted', { name: rider.name, mount: mount.name }));
  announce('dismounted', { mount, rider });
  return true;
}

/* -------------------------------------------- */
/*  Tokens (the active GM)                       */
/* -------------------------------------------- */

const isActiveGm = () => !!globalThis.game?.users?.activeGM?.isSelf;

/** A token update that moves it without counting as its movement. */
function teleport(token, position) {
  const source = token._source ?? {};
  return {
    [token.id]: { waypoints: [{
      x: position.x, y: position.y, elevation: source.elevation ?? 0, width: source.width ?? 1, height: source.height ?? 1,
      depth: source.depth, shape: source.shape, level: source.level, action: 'displace', snapped: false, explicit: false, checkpoint: true,
    }] },
  };
}

/**
 * Brings the tokens on a scene into line with its riders: a rider's token sits centred on the mount's, drawn above it;
 * one no longer riding comes back beside it. The viewed scene by default.
 * @param {Actor} mount
 * @param {Scene} [scene]
 */
export async function syncRiderTokens(mount, scene = globalThis.canvas?.scene) {
  if (!isActiveGm() || !mount || !scene) {
    return;
  }

  const mountToken = tokenOf(mount, scene);
  const size = scene.grid?.size ?? 100;
  const riding = new Set(riderEntries(mount).map(entry => entry.uuid));
  const updates = [];
  const movement = {};
  for (const rider of ridersOf(mount)) {
    const token = tokenOf(rider, scene);
    if (token && mountToken) {
      const position = ridePosition(mountToken, token, size);
      updates.push({ _id: token.id, ...position, sort: Math.max(token.sort ?? 0, (mountToken.sort ?? 0) + 1), [`flags.essence20.${RIDING_ON_FLAG}`]: mount.uuid });
      Object.assign(movement, teleport(token, position));
    }
  }

  const leaving = [...(scene.tokens ?? [])].filter(token => token.flags?.essence20?.[RIDING_ON_FLAG] == mount.uuid && !riding.has(token.actor?.uuid));
  if (leaving.length) {
    const { disembarkPositions } = await import("../vehicles/zord-recall.mjs");
    const positions = mountToken ? disembarkPositions(mountToken, leaving.length, size, scene.dimensions?.sceneRect ?? null) : [];
    leaving.forEach((token, i) => {
      updates.push({ _id: token.id, ...(positions[i] ?? {}), [`flags.essence20.-=${RIDING_ON_FLAG}`]: null });
      if (positions[i]) {
        Object.assign(movement, teleport(token, positions[i]));
      }
    });
  }

  if (updates.length) {
    await scene.updateEmbeddedDocuments('Token', updates, { animate: false, movement, essence20Mount: true });
  }
}

/** The mount's token moved: its riders' tokens go with it. */
export async function followMount(mountToken) {
  const mount = mountToken?.actor;
  const scene = mountToken?.parent;
  if (!isActiveGm() || !isRideable(mount) || !scene) {
    return;
  }

  const size = scene.grid?.size ?? 100;
  const updates = [];
  const movement = {};
  for (const token of scene.tokens ?? []) {
    if (token.flags?.essence20?.[RIDING_ON_FLAG] != mount.uuid) {
      continue;
    }

    const position = ridePosition(mountToken, token, size);
    const at = tokenAt(token);
    if (position.x != at.x || position.y != at.y) {
      updates.push({ _id: token.id, ...position });
      Object.assign(movement, teleport(token, position));
    }
  }

  if (updates.length) {
    await scene.updateEmbeddedDocuments('Token', updates, { animate: false, movement, essence20Mount: true });
  }
}

/**
 * Where the mount goes when its rider's token is dragged: by the same distance. Null when the token isn't riding or
 * didn't move. Exported for tests.
 * @param {TokenDocument} riderToken   as it is now.
 * @param {Object} changes   its update.
 * @param {TokenDocument} mountToken
 * @returns {{x: Number, y: Number}|null}
 */
export function mountMoveFor(riderToken, changes, mountToken) {
  if (!mountToken || !('x' in changes || 'y' in changes)) {
    return null;
  }

  const from = tokenAt(riderToken);
  const to = tokenAt(mountToken);
  const dx = (changes.x ?? from.x) - from.x;
  const dy = (changes.y ?? from.y) - from.y;
  return dx || dy ? { x: to.x + dx, y: to.y + dy } : null;
}

if (typeof Hooks != 'undefined') {
  Hooks.on('updateActor', (actor, changes) => {
    const flags = changes?.flags?.essence20 ?? {};
    if (RIDERS_FLAG in flags || `-=${RIDERS_FLAG}` in flags) {
      syncRiderTokens(actor);
    }
  });

  Hooks.on('updateToken', (document, changes, options) => {
    if (!options?.essence20Mount && ['x', 'y', 'width', 'height'].some(key => key in changes)) {
      followMount(document);
    }

    // An unlinked mount keeps its riders on its token's delta.
    if (changes?.delta?.flags?.essence20 && RIDERS_FLAG in changes.delta.flags.essence20) {
      syncRiderTokens(document.actor, document.parent);
    }
  });

  // Dragging a rider moves the mount instead (the mount moves; the rider acts).
  Hooks.on('preUpdateToken', (document, changes, options) => {
    const mountUuid = document.flags?.essence20?.[RIDING_ON_FLAG];
    if (!mountUuid || options?.essence20Mount) {
      return true;
    }

    const mountToken = tokenOf(resolve(mountUuid), document.parent);
    const position = mountMoveFor(document, changes, mountToken);
    if (!position) {
      return true;
    }

    if (mountToken.isOwner) {
      mountToken.update(position);
    } else {
      globalThis.ui?.notifications?.warn?.(T('MoveTheMount', { name: document.name, mount: mountToken.name }));
    }

    return false;
  });
}

/* -------------------------------------------- */
/*  Sheets and the token HUD                     */
/* -------------------------------------------- */

/**
 * The mounts beside a token that its actor could get on: rideable tokens touching it on its scene. Exported for tests.
 * @param {TokenDocument} token
 * @returns {TokenDocument[]}
 */
export function mountsBeside(token) {
  const scene = token?.parent;
  const size = scene?.grid?.size ?? 100;
  return [...(scene?.tokens ?? [])].filter(other => other.id != token.id && isRideable(other.actor) && !sameActor(other.actor, token.actor)
    && tokensAdjacent(other, token, size));
}

/**
 * The token HUD's Ride / Dismount: off what they ride; else onto the one mount beside them (the targeted one when
 * there are several).
 * @param {TokenDocument} token
 */
export async function rideOrDismount(token) {
  const rider = token?.actor;
  const riding = mountOf(rider);
  if (riding) {
    return dismount(riding.mount, rider);
  }

  const beside = mountsBeside(token);
  const targeted = beside.filter(other => other.object?.isTargeted || [...(globalThis.game?.user?.targets ?? [])].some(target => target.document == other));
  const pick = beside.length == 1 ? beside[0] : targeted.length == 1 ? targeted[0] : null;
  if (!pick) {
    globalThis.ui?.notifications?.warn?.(T(beside.length ? 'TargetOne' : 'NoneBeside', { name: rider?.name ?? '' }));
    return false;
  }

  return mountUp(pick.actor, rider);
}

if (typeof Hooks != 'undefined') {
  Hooks.on('renderTokenHUD', (hud, html) => {
    const token = hud.document;
    const riding = !!mountOf(token?.actor);
    if (!token?.actor || (!riding && !mountsBeside(token).length)) {
      return;
    }

    const column = html.querySelector('.col.left') ?? html.querySelector('.col.right');
    if (!column || column.querySelector('.essence20-mount')) {
      return;
    }

    const label = T(riding ? 'Dismount' : 'Ride');
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add('control-icon', 'essence20-mount');
    button.dataset.tooltip = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = `<i class="fa-solid fa-${riding ? 'person-walking-arrow-loop-left' : 'horse'}"></i>`;
    button.addEventListener('click', async () => {
      await rideOrDismount(token);
      hud.close?.();
    });
    column.appendChild(button);
  });
}

/** The sheet header's "Riding ..." line for a rider, or null. */
export function ridingSheetContext(actor) {
  const riding = mountOf(actor);
  return riding ? { mountName: riding.mount.name, mountUuid: riding.mount.uuid } : null;
}

/** The sheet header's "Ridden by ..." line for a mount, or null when it can't be ridden. */
export function ridersSheetContext(actor) {
  if (!isRideable(actor)) {
    return null;
  }

  const riders = riderEntries(actor);
  return { riders, limit: riderLimit(actor), full: riders.length >= riderLimit(actor) };
}
