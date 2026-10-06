/**
 * Shared bits for the other1 extension modules (A Jump Through Time, Across the Stars, Beneath the
 * Helmet, Cobra Codex, Dark Skies over Equestria and Decepticon Directive items): their compendium
 * packs, a Personal Power payment, a flagged chat card, the actors in play and a Defense adder. The
 * generic lookups, lang, stamp and relayed-write helpers live in item-lookups.mjs, item-lang.mjs,
 * turn-stamps.mjs and relayed-writes.mjs.
 */

export const JTT = id => `Compendium.essence20.jump_through_time.Item.${id}`;
export const ATS = id => `Compendium.essence20.across_the_stars.Item.${id}`;
export const BTH = id => `Compendium.essence20.beneath_the_helmet.Item.${id}`;
export const CC = id => `Compendium.essence20.cobra_codex.Item.${id}`;
export const DSOE = id => `Compendium.essence20.dark_skies_over_equestria.Item.${id}`;
export const DD = id => `Compendium.essence20.decepticon_directive.Item.${id}`;

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

export async function post(actor, content, flags = null) {
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    ...(flags ? { flags: { essence20: flags } } : {}),
  });
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
  const { worldActors } = await import("../../mechanics/companions/companion-link.mjs");
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
