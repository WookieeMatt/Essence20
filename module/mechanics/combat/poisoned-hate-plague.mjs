import {
  registerAfterDamage, registerChatButton, registerDerived, registerHitRider, registerRest, registerRollSources,
} from "../item-hooks.mjs";
import { onceHook, onHook } from "../../items/shared/hooks-and-clients.mjs";
import { say } from "../../items/shared/chat-lines.mjs";
import { T } from "../../items/shared/item-lang.mjs";

/**
 * Two Conditions: Poisoned (Welcome to Night Vale Host Guide p.48) and the Hate Plague (Transformers
 * extras, "The Hate Plague").
 *
 * The 'poisoned' status already exists (util/config.mjs) as a marker; this gives it its rules.
 * The Hate Plague gets a status of its own ('hatePlague'), added to CONFIG.statusEffects at setup,
 * and everything it does is read off that status.
 */

export const HATE_PLAGUE = 'hatePlague';
const HEAL_BYPASS = 'd22PoisonBypass';

/* -------------------------------------------- */
/*  Poisoned                                     */
/* -------------------------------------------- */

/**
 * Poison damage (WTNV HG p.36; GI Joe CRB): "A long-term effect that causes the Poisoned Condition
 * as it causes damage."
 */
export async function poisonOnDamage(actor, dealt, damageType) {
  if (damageType != 'poison' || !(dealt > 0) || actor?.statuses?.has?.('poisoned')) {
    return;
  }

  await actor.toggleStatusEffect?.('poisoned', { active: true });
}

/**
 * Poisoned (WTNV HG p.48): "Poisoned characters are not able to recover damage or Essence Points
 * until the poison is removed." Any update that would raise Health while the Condition is on is held
 * at the current value (preUpdateActor). Pass {[HEAL_BYPASS]: true} in the update options to force it.
 * @returns {Boolean}   Whether the update was changed.
 */
export function holdPoisonedHealth(actor, changes, options = {}) {
  if (!actor?.statuses?.has?.('poisoned') || options?.[HEAL_BYPASS]) {
    return false;
  }

  const current = Number(actor.system?.health?.value);
  const flat = changes?.['system.health.value'];
  const nested = changes?.system?.health?.value;
  let held = false;
  if (flat !== undefined && Number(flat) > current) {
    changes['system.health.value'] = current;
    held = true;
  }

  if (nested !== undefined && Number(nested) > current) {
    changes.system.health.value = current;
    held = true;
  }

  return held;
}

onHook('preUpdateActor', (actor, changes, options, userId) => {
  if (userId && game.user?.id && userId != game.user.id) {
    return;
  }

  if (holdPoisonedHealth(actor, changes, options)) {
    ui.notifications?.warn?.(T('D22PoisonedNoHeal', { name: actor.name }));
  }
});

/**
 * "For each day the poison persists, apply 1 additional damage." A Rest is the day's sleep: the
 * poisoned character heals nothing and takes 1 damage instead. "Treating the Poisoned Condition
 * requires a DIF 15 Science (Medicine) Skill Test that takes an hour" (p.37) - the Heal action's
 * poison mode (extensions/other2/medic.mjs).
 */
export async function poisonOnRest(actor) {
  if (!actor?.statuses?.has?.('poisoned')) {
    return;
  }

  const { applyDamage } = await import("./combat.mjs");
  await applyDamage(actor, 1, 'poison');
  await say(actor, T('D22PoisonedRest', { name: actor.name }));
}

registerAfterDamage((actor, dealt, damageType) => poisonOnDamage(actor, dealt, damageType));
registerRest(actor => poisonOnRest(actor));

/* -------------------------------------------- */
/*  The Hate Plague                              */
/* -------------------------------------------- */

onceHook('setup', () => {
  const list = CONFIG.statusEffects;
  if (Array.isArray(list) && !list.some(status => status.id == HATE_PLAGUE)) {
    list.push({ id: HATE_PLAGUE, name: 'E20.D22StatusHatePlague', img: 'icons/svg/biohazard.svg' });
  }
});

const infected = actor => !!actor?.statuses?.has?.(HATE_PLAGUE);

/**
 * "All Social-based skills are made with a Snag. Athletics, Brawn, and Might Skill Tests are all
 * made with ↑2."
 */
export function hatePlagueRollSources(actor, target, { rolledSkill, rolledEssence } = {}) {
  const sources = [];
  if (!infected(actor)) {
    return { sources, consumes: [] };
  }

  const label = T('D22StatusHatePlague');
  if (rolledEssence == 'social' || CONFIG.E20?.skillToEssence?.[rolledSkill] == 'social') {
    sources.push({ id: 'd22HatePlagueSnag', label, snag: true });
  }

  if (['athletics', 'brawn', 'might'].includes(rolledSkill)) {
    sources.push({ id: 'd22HatePlagueRage', label, shiftUp: 2 });
  }

  return { sources, consumes: [] };
}

registerRollSources((actor, target, ctx) => hatePlagueRollSources(actor, target, ctx));

/** "...and Resistant to Psychic Damage." */
export function hatePlagueDerived(actor) {
  if (infected(actor) && actor.system?.resistances) {
    actor.system.resistances.psychic = true;
  }
}

registerDerived(hatePlagueDerived);

/** "The victim has Immunity to the Frightened and Mesmerized conditions." */
export function blocksCondition(actor, statuses) {
  return infected(actor) && statuses.some(status => ['frightened', 'mesmerized'].includes(status));
}

onHook('preCreateActiveEffect', (effect) => {
  const actor = effect?.parent;
  const statuses = [...(effect?.statuses ?? effect?._source?.statuses ?? [])];
  if (actor?.documentName == 'Actor' && blocksCondition(actor, statuses)) {
    ui.notifications?.info?.(T('D22HatePlagueImmune', { name: actor.name }));
    return false;
  }

  return true;
});

/**
 * "The victim's unarmed attacks gain the following additional Alternate Effect: 'Target becomes
 * infected with Hate Plague.'" A hit with an unarmed attack puts a button on the card to take that
 * effect instead.
 */
export async function hatePlagueHit(actor, target, result, rider) {
  if (!infected(actor) || !target || infected(target) || result?.success === false || !rider?.isUnarmed) {
    return;
  }

  await say(actor, `<p>${T('D22HatePlagueSpread', { name: actor.name, target: target.name })}</p>`
    + `<button type="button" data-e20-ext="d22HatePlagueInfect" data-uuid="${target.uuid}">${T('D22HatePlagueInfect')}</button>`);
}

registerHitRider((actor, target, result, rider) => hatePlagueHit(actor, target, result, rider));

registerChatButton('d22HatePlagueInfect', async (message, button) => {
  const target = await fromUuid(button.dataset.uuid);
  if (target && !infected(target)) {
    await target.toggleStatusEffect(HATE_PLAGUE, { active: true });
    button.disabled = true;
  }
});
