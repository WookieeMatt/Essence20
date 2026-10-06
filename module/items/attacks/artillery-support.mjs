import { registerChatButton, registerTurnStart, registerUse } from "../../mechanics/item-hooks.mjs";
import { G2, T, escape, post, sourceOf } from "../shared/gij-crb-item-lookups.mjs";

/**
 * Artillery Support (GI JOE CRB, Gear, p.163): "Calling in an air strike requires a full turn, and
 * the strike lands at the beginning of your next turn." The five strikes:
 * - Flare: "provides bright light over the area of a city block for 5 minutes."
 * - High Explosive: "Deals 2 Fire Element and 2 Blunt damage to a 40 foot radius against Evasion
 *   Defense. Those who Defend suffer 1 Fire Element and 1 Blunt damage."
 * - High Explosive Anti-Tank: "directed at a single vehicle or armored location ... dealing 4 Blunt and
 *   4 Fire Element damage to the target, based on a Targeting (Artillery) Attack against the target's
 *   Toughness Defense. A secondary attack deals 2 Fire Element damage to creatures within 10 feet
 *   against their Evasion Defense."
 * - Shrapnel: "Deals 4 Sharp damage to targets in a 30 foot radius area as part of a Targeting
 *   (Artillery) attack against Evasion Defense."
 * - Smoke: "heavily obscure an area with a 60 foot radius and lasts for a minute (12 rounds)".
 *
 * The gear's Use button picks the strike and the spot (or the targeted vehicle, for HEAT), pays the
 * Full Action and records the call. At the caller's next turn start (or straight away out of combat)
 * a card offers "Bring it in": that rolls the caller's Targeting against every token in the blast
 * (one roll, each token's own Defense - the system's multi-target Skill Test), then lists each token
 * with an Apply button for what it takes. High Explosive's "those who Defend" are the ones the roll
 * didn't beat.
 */

export const PENDING_FLAG = 'gij2ArtilleryCall';

export const STRIKES = {
  flare: { radius: 0 },
  he: { radius: 40, defense: 'evasion', hit: [[2, 'fire'], [2, 'blunt']], miss: [[1, 'fire'], [1, 'blunt']] },
  heat: { radius: 0, defense: 'toughness', hit: [[4, 'blunt'], [4, 'fire']], miss: [], secondary: { radius: 10, defense: 'evasion', hit: [[2, 'fire']], miss: [] } },
  shrapnel: { radius: 30, defense: 'evasion', hit: [[4, 'sharp']], miss: [] },
  smoke: { radius: 60 },
};

const strikeLabel = key => T(`E20.Gij2Artillery_${key}`);

function tokensWithin(point, feet, exclude = null) {
  if (!canvas?.tokens || !canvas?.grid || !point) {
    return [];
  }

  return canvas.tokens.placeables.filter(token => token.actor && token !== exclude
    && canvas.grid.measurePath([point, token.center]).distance <= feet);
}

async function callStrike(item, economy, pay) {
  const actor = item.parent;
  const { chooseButtons } = await import("../../mechanics/resources/grants.mjs");
  const strike = await chooseButtons(item.name, T('E20.Gij2ArtilleryPick'), Object.keys(STRIKES).map(key => [key, strikeLabel(key)]));
  if (!STRIKES[strike]) {
    return null;
  }

  let point = null;
  let targetUuid = null;
  if (strike == 'heat') {
    const token = game.user?.targets?.first?.();
    if (!token?.actor) {
      ui.notifications.warn(T('E20.Gij2NeedsTarget', { perk: strikeLabel('heat') }));
      return null;
    }

    targetUuid = token.document?.uuid ?? null;
    point = { x: token.center.x, y: token.center.y };
  } else {
    const { pickCanvasPoint } = await import("../../mechanics/combat/forced-movement.mjs");
    point = await pickCanvasPoint(T('E20.Gij2ArtilleryPoint'));
    if (!point) {
      return null;
    }
  }

  if (!(await pay('fullAction'))) {
    return null;
  }

  const call = { strike, point: { x: point.x, y: point.y }, targetUuid, sceneId: canvas?.scene?.id ?? null, combatId: game.combat?.id ?? null };
  await actor.setFlag('essence20', PENDING_FLAG, call);
  if (!game.combat) {
    await landingCard(actor);
  }

  return T('E20.Gij2ArtilleryCalled', { name: actor.name, strike: strikeLabel(strike) });
}

registerUse({
  id: 'gij2ArtillerySupport',
  matches: item => sourceOf(item) == G2.artillerySupport && !!item.parent,
  run: callStrike,
});

export async function landingCard(actor) {
  const call = actor?.flags?.essence20?.[PENDING_FLAG];
  if (!call) {
    return null;
  }

  return post(actor, `<p>${T('E20.Gij2ArtilleryLands', { name: actor.name, strike: strikeLabel(call.strike) })}</p>`
    + `<button type="button" data-e20-ext="gij2ArtilleryLand" data-actor="${actor.uuid}">${T('E20.Gij2ArtilleryBringIn')}</button>`);
}

registerTurnStart(async (actor) => {
  if (actor?.flags?.essence20?.[PENDING_FLAG]) {
    await landingCard(actor);
  }
});

/** One Targeting roll against each token's Defense - {tokenId: hit}. */
async function rollAgainst(actor, tokens, defenseType) {
  if (!tokens.length) {
    return {};
  }

  const before = [...(game.user?.targets ?? [])].map(t => t.id);
  canvas.tokens.setTargets(tokens.map(t => t.id));
  let outcome = null;
  try {
    outcome = await actor._dice?.rollSkill({
      skill: 'targeting', essence: CONFIG.E20.skillToEssence?.targeting ?? 'speed', shiftUp: 0, shiftDown: 0, defenseType,
    }, actor);
  } finally {
    canvas.tokens.setTargets(before);
  }

  const hits = {};
  for (const result of outcome?.outcomes?.flatMap(o => o.results ?? []) ?? []) {
    const token = tokens.find(t => t.actor?.uuid == result.targetUuid || t.document?.uuid == result.targetUuid);
    if (token) {
      hits[token.id] = !!result.success;
    }
  }

  return hits;
}

function applyButtons(token, packets) {
  return packets.map(([amount, type]) => `<button type="button" data-e20-ext="gij2ArtilleryDamage" data-token="${token.document.uuid}" data-amount="${amount}" data-type="${type}">`
    + `${escape(token.name)}: ${amount} ${game.i18n.localize(CONFIG.E20.damageTypes?.[type] ?? type)}</button>`).join('');
}

export function strikeRows(tokens, hits, profile) {
  return tokens.map(token => {
    const hit = hits[token.id];
    const packets = hit ? profile.hit : profile.miss;
    const tag = hit ? T('E20.Gij2ArtilleryHit') : T('E20.Gij2ArtilleryMiss');
    return `<p>${escape(token.name)} - ${tag}</p>${packets?.length ? applyButtons(token, packets) : ''}`;
  }).join('');
}

registerChatButton('gij2ArtilleryLand', async (message, button) => {
  const actor = await fromUuid(button.dataset.actor);
  const call = actor?.flags?.essence20?.[PENDING_FLAG];
  if (!actor?.isOwner || !call) {
    return;
  }

  await actor.unsetFlag('essence20', PENDING_FLAG);
  const profile = STRIKES[call.strike];
  if (call.sceneId && canvas?.scene?.id != call.sceneId) {
    ui.notifications.warn(T('E20.Gij2ArtilleryOtherScene'));
    return;
  }

  // Flare and Smoke do no damage - the card records what covers the area.
  if (!profile.hit) {
    await post(actor, T(`E20.Gij2ArtilleryEffect_${call.strike}`, { radius: profile.radius }));
    return;
  }

  let html = `<h3>${strikeLabel(call.strike)}</h3>`;
  if (call.strike == 'heat') {
    const target = call.targetUuid ? await fromUuid(call.targetUuid) : null;
    const token = target?.object ?? null;
    if (token) {
      const hits = await rollAgainst(actor, [token], profile.defense);
      html += strikeRows([token], hits, profile);
      const splash = tokensWithin(token.center, profile.secondary.radius, token);
      const splashHits = await rollAgainst(actor, splash, profile.secondary.defense);
      html += strikeRows(splash, splashHits, profile.secondary);
    }
  } else {
    const tokens = tokensWithin(call.point, profile.radius);
    const hits = await rollAgainst(actor, tokens, profile.defense);
    html += strikeRows(tokens, hits, profile);
  }

  await post(actor, html);
});

registerChatButton('gij2ArtilleryDamage', async (message, button) => {
  const doc = await fromUuid(button.dataset.token);
  const target = doc?.actor ?? doc;
  if (!target) {
    return;
  }

  if (!target.isOwner) {
    ui.notifications.warn(T('E20.Gij2GmApplies'));
    return;
  }

  const { applyDamage } = await import("../../mechanics/combat/combat.mjs");
  await applyDamage(target, Number(button.dataset.amount) || 0, button.dataset.type);
  button.disabled = true;
});
