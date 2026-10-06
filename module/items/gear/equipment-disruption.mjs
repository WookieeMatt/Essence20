import { actorHasPerk } from "../../mechanics/characters/perks.mjs";
import { E20 } from "../../util/config.mjs";

/**
 * Disrupting equipment - the Disruptor Focus (Quartermaster's Guide to Gear, Ranger, p.26-27).
 *
 * - Technical Glitch (3rd level): "you can attempt a Technology Skill Test to disrupt a piece of
 *   equipment with the Computerized trait within 100ft, causing it to fail until it is rebooted as
 *   a Move action."
 * - Some Assembly Required (6th level): "when you're not in combat, you can attempt a Technology
 *   Skill Test to disassemble a piece of equipment. Write down the result of the Skill Test, which
 *   becomes the DIF to reboot the item. The item will not function until it is rebooted."
 * - Complete System Failure (20th level): "if you successfully disrupt a piece of equipment, any
 *   Skill Tests to repair or use the equipment or that the equipment makes permanently gain Snag
 *   and ↓2 until you personally repair it or provide instructions to fix it."
 *
 * A disrupted Item carries flags.essence20.gij3Disrupted = {by, byName, inoperable, rebootDif,
 * csf}. "Fails" is the Item being unequipped (the same thing a disarm does - an unequipped armor
 * gives no Defense, an unequipped weapon isn't held) plus a warning if it's used anyway; the chat
 * card the disruption posts has a Reboot button for the owner, and - with Complete System Failure -
 * a Repair button only the disruptor can press. Rolls with the Item (and rolls to reboot it) read the
 * Snag and ↓2 through gij3.mjs's roll sources.
 *
 * The DIF for Technical Glitch isn't printed; this uses the unattended-equipment DIF the same page
 * gives Deconstructionist ("roll against the equipment's availability DIF"). A DIF of 0 (Standard)
 * succeeds without a roll.
 */

const QGTG = "Compendium.essence20.quartermasters_guide_to_gear.Item.";
export const TECHNICAL_GLITCH_ID = `${QGTG}ipHeh6e5De537NhH`;
export const SOME_ASSEMBLY_REQUIRED_ID = `${QGTG}a9rsM3e8i54VoEPI`;
export const COMPLETE_SYSTEM_FAILURE_ID = `${QGTG}eMliZALtmapa7zoo`;
export const DISRUPTED_FLAG = 'gij3Disrupted';

const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));
const escape = text => foundry.utils.escapeHTML(String(text ?? ''));

function listOf(collection) {
  if (Array.isArray(collection?.contents)) {
    return collection.contents;
  }

  return collection && typeof collection[Symbol.iterator] == 'function' ? [...collection] : [];
}

export function disruptedOf(item) {
  return item?.flags?.essence20?.[DISRUPTED_FLAG] ?? null;
}

/** Equipment that can be disrupted: anything carried that has a Computerized trait. */
export function computerizedItems(actor) {
  return listOf(actor?.items).filter(item => ['weapon', 'armor', 'gear', 'shield', 'upgrade'].includes(item.type)
    && (item.system?.traits ?? []).includes('computerized'));
}

/** Anything carried, for Some Assembly Required ("a piece of equipment"). */
export function equipmentItems(actor) {
  return listOf(actor?.items).filter(item => ['weapon', 'armor', 'gear', 'shield'].includes(item.type));
}

export function availabilityDif(item) {
  const availability = item?.system?.totalAvailability ?? item?.system?.availability ?? 'standard';
  return E20.availabilityDifficulties?.[availability] ?? 0;
}

/**
 * Complete System Failure's lingering penalty on a roll - Snag and ↓2 - when the rolled item (a
 * weaponEffect's parent weapon) or the item being rebooted carries it.
 * @param {Actor} actor
 * @param {Object} ctx   Roll source ctx ({item, dataset}).
 * @returns {Object|null}   A roll source, or null.
 */
export function csfSource(actor, ctx = {}) {
  const items = [];
  const item = ctx.item;
  if (item?.type == 'weaponEffect') {
    const parentId = item.flags?.essence20?.parentId;
    items.push(parentId ? (actor?.items?.get?.(parentId) ?? listOf(actor?.items).find(i => i.id == parentId)) : null);
  } else if (item) {
    items.push(item);
  }

  const repairUuid = ctx.dataset?.gij3RepairItemUuid;
  if (repairUuid) {
    try {
      items.push(fromUuidSync(repairUuid));
    } catch (error) {
      // An item that no longer exists carries no penalty.
    }
  }

  const hit = items.find(i => disruptedOf(i)?.csf);
  return hit ? { id: 'gij3CompleteSystemFailure', label: T('Gij3CsfSource', { item: hit.name }), snag: true, shiftDown: 2 } : null;
}

async function writeItem(item, update) {
  const { needsGmRelay, relayToGm } = await import("../../mechanics/world/gm-relay.mjs");
  if (needsGmRelay(item)) {
    return relayToGm(item, 'update', [update]);
  }

  await item.update(update);
  return true;
}

async function pickItem(title, items) {
  const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
  const picked = await chooseSelect(title, T('Gij3DisruptPick'), items.map(i => ({ value: i.uuid, label: `${i.name} (${i.parent?.name ?? ''})` })));
  return items.find(i => i.uuid == picked) ?? null;
}

/**
 * Marks the item disrupted and posts the card.
 * @param {Actor} actor   The disruptor.
 * @param {Item} item
 * @param {Object} options   {rebootDif}
 */
export async function disruptItem(actor, item, { rebootDif = null } = {}) {
  const csf = actorHasPerk(actor, COMPLETE_SYSTEM_FAILURE_ID);
  const state = { by: actor.uuid, byName: actor.name, inoperable: true, rebootDif, csf };
  await writeItem(item, { [`flags.essence20.${DISRUPTED_FLAG}`]: state, 'system.equipped': false });
  const buttons = [`<button type="button" data-e20-ext="gij3Reboot" data-item-uuid="${item.uuid}">${T('Gij3RebootButton')}</button>`];
  if (csf) {
    buttons.push(`<button type="button" data-e20-ext="gij3CsfRepair" data-item-uuid="${item.uuid}">${T('Gij3CsfRepairButton')}</button>`);
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p>${T(rebootDif ? 'Gij3DisassembledChat' : 'Gij3DisruptedChat', { name: escape(actor.name), item: escape(item.name), owner: escape(item.parent?.name), dif: rebootDif })}</p>`
      + (csf ? `<p>${T('Gij3CsfChat')}</p>` : '') + buttons.join(''),
  });
}

/** Technical Glitch's Use button. */
export async function useTechnicalGlitch(item, pay) {
  const actor = item.parent;
  const target = game.user?.targets?.first?.()?.actor;
  if (!target) {
    ui.notifications.warn(T('Gij3DisruptNoTarget'));
    return null;
  }

  const candidates = computerizedItems(target).filter(i => !disruptedOf(i)?.inoperable);
  if (!candidates.length) {
    ui.notifications.warn(T('Gij3DisruptNoComputerized', { name: target.name }));
    return null;
  }

  const picked = await pickItem(item.name, candidates);
  if (!picked || !(await pay('standard'))) {
    return null;
  }

  const dif = availabilityDif(picked);
  let success = dif <= 0;
  if (!success) {
    const { rollTest } = await import("../../mechanics/resources/grants.mjs");
    success = (await rollTest(actor, 'technology', dif)).success;
  }

  if (!success) {
    return T('Gij3DisruptFailed', { name: actor.name, item: picked.name });
  }

  await disruptItem(actor, picked);
  return null;
}

/** Some Assembly Required's Use button - out of combat only. */
export async function useSomeAssemblyRequired(item) {
  const actor = item.parent;
  if (game.combat) {
    ui.notifications.warn(T('Gij3NotInCombat'));
    return null;
  }

  const target = game.user?.targets?.first?.()?.actor ?? null;
  if (!target) {
    ui.notifications.warn(T('Gij3DisruptNoTarget'));
    return null;
  }

  const picked = await pickItem(item.name, equipmentItems(target).filter(i => !disruptedOf(i)?.inoperable));
  if (!picked) {
    return null;
  }

  // No DIF: the result itself is what's written down.
  const result = await actor._dice?.rollSkill({ skill: 'technology', essence: 'smarts', shiftUp: 0, shiftDown: 0 }, actor);
  const total = result?.outcomes?.[0]?.roll?.total;
  if (!Number.isFinite(total)) {
    return null;
  }

  await disruptItem(actor, picked, { rebootDif: total });
  return null;
}

/** The Reboot button: a Move action (or the written-down DIF, for a disassembled item). */
export async function onRebootButton(message, button) {
  const item = await fromUuid(button.dataset.itemUuid);
  const owner = item?.parent;
  const state = disruptedOf(item);
  if (!item || !state?.inoperable) {
    ui.notifications.info(T('Gij3NothingToReboot'));
    return;
  }

  if (!owner?.isOwner) {
    ui.notifications.warn(T('Gij3NotYours'));
    return;
  }

  if (state.rebootDif) {
    const { rollTest } = await import("../../mechanics/resources/grants.mjs");
    const test = await rollTest(owner, 'technology', state.rebootDif, { gij3RepairItemUuid: item.uuid });
    if (!test.success) {
      return;
    }
  } else if (game.combat) {
    const economy = await import("../../mechanics/actions/action-economy.mjs");
    const paid = await economy.spend(owner, 'move', { source: T('Gij3RebootButton') });
    if (paid?.blocked) {
      return;
    }
  }

  const update = { 'system.equipped': true };
  if (state.csf) {
    update[`flags.essence20.${DISRUPTED_FLAG}.inoperable`] = false;
  } else {
    update[`flags.essence20.-=${DISRUPTED_FLAG}`] = null;
  }

  await item.update(update);
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: owner }), content: T('Gij3Rebooted', { name: owner.name, item: item.name }) });
}

/** Complete System Failure's "until you personally repair it" - only the disruptor's user may press it. */
export async function onCsfRepairButton(message, button) {
  const item = await fromUuid(button.dataset.itemUuid);
  const state = disruptedOf(item);
  if (!item || !state?.csf) {
    return;
  }

  const disruptor = await fromUuid(state.by);
  if (!disruptor?.isOwner) {
    ui.notifications.warn(T('Gij3CsfOnlyDisruptor', { name: state.byName }));
    return;
  }

  await writeItem(item, { [`flags.essence20.-=${DISRUPTED_FLAG}`]: null, ...(state.inoperable ? { 'system.equipped': true } : {}) });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: disruptor }), content: T('Gij3CsfRepaired', { name: disruptor.name, item: item.name }) });
}

/** A weapon that's still inoperable - warn when its attack is rolled anyway. */
export function inoperableWarning(actor, dataset, item) {
  if (item?.type != 'weaponEffect') {
    return;
  }

  const parentId = item.flags?.essence20?.parentId;
  const weapon = parentId ? actor?.items?.get?.(parentId) : null;
  if (disruptedOf(weapon)?.inoperable) {
    ui.notifications.warn(T('Gij3StillInoperable', { item: weapon.name }));
  }
}
