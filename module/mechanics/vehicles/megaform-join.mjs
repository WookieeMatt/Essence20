import { announce } from "../world/public-hooks.mjs";
import { getMegaformParticipants } from "./megaform-participants.mjs";

/**
 * Join and Separate: a Megaform's members' tokens on the scene become the Megaform's token, and back - for Zords forming
 * a Megazord and Transformers merging into a Combiner alike.
 *
 * Who is in the Megaform is its roster (system.actors - built on its sheet, or by the Combiner merge); Join is the moment
 * it takes the field: the members' tokens on this scene are removed, and the Megaform's token is put where they stood
 * (centred on them), remembering each one (its whole token data, and its place in the turn order) on the Megaform's
 * token. Separate puts them back around wherever the Megaform is now, as they were arranged; a Megaform that is Defeated
 * and breaks apart (items/zords/combiner-merge.mjs#breakApart) puts them back the same way.
 *
 * The Zords' join timer (combiner-timer.mjs, PR CRB p.139) stays advisory: joining early asks first.
 *
 * Hooks: essence20.megaformFormed {form, token, members, from} (from: each member token's centre, before it went) and
 * essence20.megaformSplit {form, components, isCombiner, voluntary, tokens, at, to} (at: where the Megaform stood, with its
 * width; to: each member token's centre).
 */

/** The token flag holding what the Megaform's token replaced: [{data, initiative}]. */
export const JOINED_FLAG = 'joinedTokens';

/** A token's centre, from its document data (x/y top-left, width/height in grid squares). */
export function centerOf(data, grid) {
  return { x: data.x + ((data.width ?? 1) * grid) / 2, y: data.y + ((data.height ?? 1) * grid) / 2 };
}

/**
 * Where the Megaform's token goes: centred on the middle of its members' tokens.
 * @param {Object[]} members   Token data ({x, y, width, height}).
 * @param {{width: Number, height: Number}} size   The Megaform token's size in grid squares.
 * @param {Number} grid        Pixels per grid square.
 * @returns {{x: Number, y: Number, center: {x: Number, y: Number}}}   Its top-left, and the centre it sits on.
 */
export function joinPlacement(members, size, grid) {
  const centres = members.map(member => centerOf(member, grid));
  const center = {
    x: centres.reduce((sum, c) => sum + c.x, 0) / Math.max(1, centres.length),
    y: centres.reduce((sum, c) => sum + c.y, 0) / Math.max(1, centres.length),
  };
  return {
    x: Math.round(center.x - ((size.width ?? 1) * grid) / 2),
    y: Math.round(center.y - ((size.height ?? 1) * grid) / 2),
    center,
  };
}

/**
 * Where each remembered member goes back: the same arrangement, moved with the Megaform - each token keeps its offset
 * from the middle the Megaform was centred on.
 * @param {Object[]} saved     Remembered token data.
 * @param {{x, y}} joinedAt    The centre the Megaform was put on when it joined.
 * @param {{x, y}} now         The Megaform token's centre now.
 * @returns {Object[]}         The token data, moved.
 */
export function separatePlacement(saved, joinedAt, now) {
  const dx = Math.round((now?.x ?? joinedAt.x) - joinedAt.x);
  const dy = Math.round((now?.y ?? joinedAt.y) - joinedAt.y);
  return saved.map(data => ({ ...data, x: data.x + dx, y: data.y + dy }));
}

/** The Megaform's members' tokens on a scene. */
export function memberTokens(form, scene) {
  const ids = new Set(getMegaformParticipants(form).map(actor => actor.id));
  return (scene?.tokens?.contents ?? [...(scene?.tokens ?? [])]).filter(token => ids.has(token.actorId) && token.actorId != form.id);
}

/** The Megaform's joined token on a scene: one of its tokens that remembers members. */
export function joinedTokenOf(form, scene) {
  return (scene?.tokens?.contents ?? [...(scene?.tokens ?? [])])
    .find(token => token.actorId == form.id && token.getFlag?.('essence20', JOINED_FLAG));
}

const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

async function chat(form, content) {
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: form }), content: `<p>${content}</p>` });
}

/**
 * Join: the members' tokens on the scene become the Megaform's token. This client must be able to create and delete
 * tokens (megaformTokens below sends a player's request to the GM).
 * @param {Actor} form
 * @param {Object} [options]
 * @param {Scene} [options.scene]   Default: the viewed scene.
 * @returns {Promise<TokenDocument|null>}   The Megaform's token, or null when nothing was joined.
 */
export async function joinMegaform(form, { scene = globalThis.canvas?.scene } = {}) {
  if (!form || !scene) {
    return null;
  }

  if (joinedTokenOf(form, scene)) {
    ui.notifications.warn(T('MegaformJoinAlready', { name: form.name }));
    return null;
  }

  const members = memberTokens(form, scene);
  if (!members.length) {
    ui.notifications.warn(T('MegaformJoinNoTokens', { name: form.name }));
    return null;
  }

  const grid = scene.grid?.size ?? 100;
  const prototype = form.prototypeToken ?? {};
  const place = joinPlacement(members.map(token => token._source ?? token), { width: prototype.width, height: prototype.height }, grid);
  // The combat its members are fighting in, if any.
  const combat = game.combats?.find(entry => entry.combatants?.some(combatant => members.some(member => member.id == combatant.tokenId))) ?? null;
  const combatantOf = token => combat?.combatants?.find(combatant => combatant.tokenId == token.id) ?? null;
  const saved = members.map(token => ({ data: token.toObject(), initiative: combatantOf(token)?.initiative ?? null, inCombat: !!combatantOf(token) }));

  const tokenData = (await form.getTokenDocument({ x: place.x, y: place.y, hidden: members.every(token => token.hidden) })).toObject();
  foundry.utils.setProperty(tokenData, `flags.essence20.${JOINED_FLAG}`, { center: place.center, members: saved });
  const [token] = await scene.createEmbeddedDocuments('Token', [tokenData]);
  if (!token) {
    return null;
  }

  // Into the turn order where its members were: at the best initiative among them.
  if (combat && saved.some(entry => entry.inCombat)) {
    const best = Math.max(...saved.map(entry => (Number.isFinite(entry.initiative) ? entry.initiative : -Infinity)));
    await combat.createEmbeddedDocuments('Combatant', [{ tokenId: token.id, sceneId: scene.id, actorId: form.id, initiative: Number.isFinite(best) ? best : null }]);
  }

  // Announced while the members' tokens are still there, so a listener can draw from where they stood.
  announce('megaformFormed', {
    form, token, members: members.map(member => member.actor).filter(Boolean), from: members.map(member => centerOf(member._source ?? member, grid)),
  });

  const combatantIds = members.map(combatantOf).filter(Boolean).map(combatant => combatant.id);
  if (combatantIds.length) {
    await combat.deleteEmbeddedDocuments('Combatant', combatantIds);
  }

  await scene.deleteEmbeddedDocuments('Token', members.map(member => member.id));
  await chat(form, T('MegaformJoined', { name: form.name, members: members.map(member => member.name).join(', ') }));
  return token;
}

/**
 * Separate: the Megaform's token gives way to its members' tokens, arranged as they were around where it stands now.
 * @param {Actor} form
 * @param {Object} [options]
 * @param {Scene} [options.scene]
 * @param {Boolean} [options.voluntary]   false when it broke apart (Defeated): the caller announces and chats that.
 * @returns {Promise<TokenDocument[]>}    The members' tokens, back.
 */
export async function separateMegaform(form, { scene = globalThis.canvas?.scene, voluntary = true } = {}) {
  const token = form && scene ? joinedTokenOf(form, scene) : null;
  if (!token) {
    if (voluntary) {
      ui.notifications.warn(T('MegaformSeparateNothing', { name: form?.name ?? '' }));
    }

    return [];
  }

  const joined = token.getFlag('essence20', JOINED_FLAG);
  const grid = scene.grid?.size ?? 100;
  const back = separatePlacement(joined.members.map(entry => entry.data), joined.center, centerOf(token._source ?? token, grid));
  // New tokens, not the old ids back.
  const tokens = await scene.createEmbeddedDocuments('Token', back.map(data => {
    const fresh = { ...data };
    delete fresh._id;
    return fresh;
  }));

  const combat = game.combats?.find(entry => entry.combatants?.some(combatant => combatant.tokenId == token.id)) ?? null;
  if (combat) {
    const formCombatant = combat.combatants.find(combatant => combatant.tokenId == token.id);
    const returning = joined.members.map((entry, index) => ({ entry, token: tokens[index] })).filter(({ entry, token: back }) => entry.inCombat && back);
    if (returning.length) {
      await combat.createEmbeddedDocuments('Combatant', returning.map(({ entry, token: back }) => ({
        tokenId: back.id, sceneId: scene.id, actorId: back.actorId, initiative: entry.initiative ?? formCombatant?.initiative ?? null,
      })));
    }

    if (formCombatant) {
      await combat.deleteEmbeddedDocuments('Combatant', [formCombatant.id]);
    }
  }

  const at = { ...centerOf(token._source ?? token, grid), w: (token._source?.width ?? token.width ?? 1) * grid };
  await scene.deleteEmbeddedDocuments('Token', [token.id]);
  if (voluntary) {
    const components = tokens.map(back => back.actor).filter(Boolean);
    announce('megaformSplit', {
      form, components, isCombiner: !!form.system?.subtype?.includes?.('megaformCombiner'), voluntary: true, tokens, at,
      to: tokens.map(back => centerOf(back._source ?? back, grid)),
    });
    await chat(form, T('MegaformSeparated', { name: form.name }));
  }

  return tokens;
}

/**
 * Join or Separate from any client: directly when this user can make and remove tokens, through the active GM
 * otherwise (mechanics/world/gm-relay.mjs, kinds megaformJoin / megaformSeparate - the Megaform's owners only).
 * @param {'join'|'separate'} what
 * @param {Actor} form
 * @returns {Promise<*>}
 */
export async function megaformTokens(what, form) {
  const scene = globalThis.canvas?.scene;
  if (!form || !scene) {
    return null;
  }

  const user = game.user;
  if (user.isGM || (user.can?.('TOKEN_CREATE') && user.can?.('TOKEN_DELETE') && scene.canUserModify?.(user, 'update'))) {
    return what == 'join' ? joinMegaform(form, { scene }) : separateMegaform(form, { scene });
  }

  const { createViaGm } = await import("../world/gm-relay.mjs");
  return createViaGm(what == 'join' ? 'megaformJoin' : 'megaformSeparate', { actorUuid: form.uuid, sceneId: scene.id });
}
