/**
 * Small helpers shared by the other1 extension modules (A Jump Through Time, Across the Stars,
 * Beneath the Helmet, Cobra Codex, Dark Skies over Equestria and Decepticon Directive items).
 */

export const JTT = id => `Compendium.essence20.jump_through_time.Item.${id}`;
export const ATS = id => `Compendium.essence20.across_the_stars.Item.${id}`;
export const BTH = id => `Compendium.essence20.beneath_the_helmet.Item.${id}`;
export const CC = id => `Compendium.essence20.cobra_codex.Item.${id}`;
export const DSOE = id => `Compendium.essence20.dark_skies_over_equestria.Item.${id}`;
export const DD = id => `Compendium.essence20.decepticon_directive.Item.${id}`;

export const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;
}

export function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  return items.contents ?? [...items];
}

/** The actor's first item copied from this compendium uuid (any type). */
export function findSourced(actor, uuid) {
  if (!uuid) {
    return null;
  }

  return itemsOf(actor).find(item => sourceOf(item) == uuid) ?? null;
}

export const isFrom = uuid => item => !!uuid && sourceOf(item) == uuid;

/** Spend Personal Power; false (and a warning) if the actor can't afford it. */
export async function payPower(actor, amount) {
  const current = Number(actor?.system?.powers?.personal?.value) || 0;
  if (current < amount) {
    ui.notifications?.warn?.(game.i18n.localize('E20.PowerOverSpent'));
    return false;
  }

  await actor.update({ 'system.powers.personal.value': current - amount });
  return true;
}

export function combatStamp() {
  const combat = game?.combat;
  return combat ? { combatId: combat.id, round: combat.round, turn: combat.turn } : { combatId: null };
}

/** The user's first targeted token's actor, if any. */
export function firstTarget() {
  const targets = game.user?.targets;
  const first = targets?.first?.() ?? (targets ? [...targets][0] : null);
  return first?.actor ?? null;
}

export function targetedActors() {
  return [...(game.user?.targets ?? [])].map(token => token.actor).filter(Boolean);
}

export async function post(actor, content, flags = null) {
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    ...(flags ? { flags: { essence20: flags } } : {}),
  });
}

/** Write an update to a document this user may not own (through the GM relay). */
export async function safeUpdate(doc, update) {
  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(doc)) {
    return relayToGm(doc, 'update', [update]);
  }

  return doc.update(update);
}

export async function safeSetFlag(doc, key, value) {
  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(doc)) {
    return relayToGm(doc, 'setFlag', ['essence20', key, value]);
  }

  return doc.setFlag('essence20', key, value);
}

export async function safeUnsetFlag(doc, key) {
  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(doc)) {
    return relayToGm(doc, 'unsetFlag', ['essence20', key]);
  }

  return doc.unsetFlag('essence20', key);
}

/** The weapon a weaponEffect belongs to. */
export function parentWeapon(actor, item) {
  if (!item) {
    return null;
  }

  if (item.type == 'weapon') {
    return item;
  }

  const parentId = item.flags?.essence20?.parentId;
  return parentId ? (actor?.items?.get?.(parentId) ?? null) : null;
}

/** Every actor in play: world actors plus unlinked tokens on the current scene. */
export async function actorsInPlay() {
  const { worldActors } = await import("../../companion-link.mjs");
  const out = new Map();
  for (const actor of worldActors()) {
    out.set(actor.uuid, actor);
  }

  for (const token of canvas?.tokens?.placeables ?? []) {
    if (token.actor) {
      out.set(token.actor.uuid, token.actor);
    }
  }

  for (const combatant of game.combat?.combatants ?? []) {
    if (combatant.actor) {
      out.set(combatant.actor.uuid, combatant.actor);
    }
  }

  return [...out.values()];
}

/**
 * Deal damage straight away if this user may write the target, otherwise post a button whoever
 * owns it (the GM) can click - see the 'o1ApplyDamage' chat button in jtt.mjs.
 */
export async function damageOrOffer(actor, target, amount, damageType, label) {
  if (target?.isOwner) {
    const { applyDamage } = await import("../../combat.mjs");
    await applyDamage(target, amount, damageType);
    await post(actor, T('O1DamageDealt', { name: actor.name, target: target.name, amount, source: label }));
    return;
  }

  await post(actor, `<p>${T('O1DamageOffered', { name: actor.name, target: target.name, amount, source: label })}</p>`
    + `<button type="button" data-e20-ext="o1ApplyDamage" data-target-uuid="${target.uuid}" data-amount="${amount}" `
    + `data-damage-type="${damageType}">${T('O1ApplyDamageButton')}</button>`);
}

/** Adds to a defense's derived total and keeps its breakdown string in step. */
export function addToDefense(defense, amount, label) {
  if (!defense || !amount) {
    return;
  }

  defense.total = (Number(defense.total) || 0) + amount;
  if (typeof defense.string == 'string') {
    defense.string += ` ${amount < 0 ? '-' : '+'} ${Math.abs(amount)} (${label})`;
  }
}
