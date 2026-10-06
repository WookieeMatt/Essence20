import { registerAfterDamage, registerChatButton, registerTurnStart } from "../../mechanics/item-hooks.mjs";
import { getUses, markUsed } from "../../mechanics/resources/scene-clock.mjs";
import { G2 } from "../shared/gij-crb-item-lookups.mjs";
import { TFull as T } from "../shared/item-lang.mjs";
import { has as hasItem, itemsOf, sourceOf } from "../shared/item-lookups.mjs";
import { say as post } from "../shared/chat-lines.mjs";
import { roundStamp } from "../shared/turn-stamps.mjs";

/**
 * Personal Shield (GI JOE CRB, Vanguard, p.108): "The shield can be activated once per encounter,
 * and activating the shield requires a Standard action. ... Once activated, the shield lasts for 1
 * minute or until it is subjected to EMP damage. A damaged or out of power shield can be repaired or
 * recharged with a one hour Technology Skill Test against a DIF 12 + half your Vanguard level".
 * Table 5-28 gives the uses (2, 3 at 3rd, 4 at 6th, 5 at 11th, 6 at 17th, unlimited at 20th).
 *
 * The Toughness/Evasion bonus is the Role Points item's own defenseBonus, switched by the sheet's
 * Activate toggle (and its Standard action, base-actor-sheet.mjs). This adds what the toggle didn't
 * enforce: a use spent per activation, once per encounter, the 1-minute (10 round) limit, EMP
 * shorting it out, and the repair/recharge test. canActivatePersonalShield is called from the
 * sheet's toggle (integration patch) before the action is paid.
 */

export const USED_FLAG = 'gij2ShieldActivated';
export const ON_FLAG = 'gij2ShieldOn';
export const BROKEN_FLAG = 'gij2ShieldBroken';
export const ROUNDS = 10;

export function isShieldItem(item) {
  return item?.type == 'rolePoints' && sourceOf(item) == G2.personalShield;
}

export function shieldOf(actor) {
  return itemsOf(actor).find(isShieldItem) ?? null;
}

function unlimited(actor, item) {
  return !!actor?.system?.useUnlimitedResource || item?.system?.resource?.max == null;
}

/**
 * Whether the shield may be switched on now; warns and returns false when not.
 * @param {Actor} actor
 * @param {Item} item   The Role Points item being toggled.
 * @returns {Boolean}
 */
export function canActivatePersonalShield(actor, item) {
  if (!isShieldItem(item)) {
    return true;
  }

  if (actor?.flags?.essence20?.[BROKEN_FLAG]) {
    ui.notifications?.warn?.(T('E20.Gij2ShieldBroken', { name: item.name }));
    return false;
  }

  if (game.combat && getUses(actor, USED_FLAG, 'encounter') > 0) {
    ui.notifications?.warn?.(T('E20.Gij2ShieldOncePerEncounter', { name: item.name }));
    return false;
  }

  if (!unlimited(actor, item) && (item.system?.resource?.value ?? 0) < 1) {
    ui.notifications?.warn?.(T('E20.Gij2ShieldNoUses', { name: item.name }));
    return false;
  }

  return true;
}

/** Spend the use and stamp the start once the shield is on. */
export async function onShieldActivated(actor, item) {
  if (!unlimited(actor, item)) {
    await item.update({ 'system.resource.value': Math.max(0, (item.system.resource.value ?? 0) - 1) });
  }

  if (game.combat) {
    await markUsed(actor, USED_FLAG, { window: 'encounter' });
  }

  await actor.setFlag('essence20', ON_FLAG, roundStamp());
}

globalThis.Hooks?.on?.('updateItem', async (item, changes, options, userId) => {
  if (userId != game.user?.id || !isShieldItem(item) || changes?.system?.isActive === undefined || !item.parent) {
    return;
  }

  if (changes.system.isActive) {
    await onShieldActivated(item.parent, item);
  } else if (item.parent.flags?.essence20?.[ON_FLAG]) {
    await item.parent.unsetFlag('essence20', ON_FLAG);
  }
});

/** Switch the shield off the way the sheet does, Protector's Shield's Temporary Health with it. */
export async function shutShield(actor, messageKey) {
  const item = shieldOf(actor);
  if (!item?.system?.isActive) {
    return false;
  }

  const { applyProtectorsShieldHealthBonus } = await import("./personal-shield.mjs");
  await applyProtectorsShieldHealthBonus(actor, false);
  await item.update({ 'system.isActive': false });
  await post(actor, T(messageKey, { name: actor.name, shield: item.name }));
  return true;
}

/** Whether the shield has run its minute: 10 rounds on from the round it went up. */
export function shieldExpired(actor, combat = game.combat) {
  const on = actor?.flags?.essence20?.[ON_FLAG];
  if (!on || !combat || on.combatId != combat.id || on.round == null) {
    return false;
  }

  return combat.round >= on.round + ROUNDS;
}

registerTurnStart(async (actor, combat) => {
  if (shieldOf(actor)?.system?.isActive && shieldExpired(actor, combat)) {
    await shutShield(actor, 'E20.Gij2ShieldExpired');
  }
});

// "until it is subjected to EMP damage" - the shield drops and needs its repair test. Impenetrable
// Shield (18th level) grants immunity to EMP damage, which stops this too.
registerAfterDamage(async (actor, dealt, damageType) => {
  if (damageType != 'emp' || !shieldOf(actor)?.system?.isActive || actor.system?.immunities?.emp
    || hasItem(actor, G2.impenetrableShield)) {
    return;
  }

  await actor.setFlag('essence20', BROKEN_FLAG, true);
  if (await shutShield(actor, 'E20.Gij2ShieldEmp')) {
    await repairCard(actor);
  }
});

export function repairDif(actor) {
  return 12 + Math.floor((Number(actor?.system?.level) || 1) / 2);
}

export async function repairCard(actor) {
  const item = shieldOf(actor);
  return post(actor, `<p>${T('E20.Gij2ShieldRepairOffer', { shield: item?.name ?? '', dif: repairDif(actor) })}</p>`
    + `<button type="button" data-e20-ext="gij2ShieldRepair" data-actor="${actor.uuid}">${T('E20.Gij2ShieldRepair')}</button>`);
}

// Offer the recharge as soon as the last use goes.
globalThis.Hooks?.on?.('updateItem', async (item, changes, options, userId) => {
  const value = changes?.system?.resource?.value;
  if (userId == game.user?.id && isShieldItem(item) && value === 0 && !unlimited(item.parent, item)) {
    await repairCard(item.parent);
  }
});

registerChatButton('gij2ShieldRepair', async (message, button) => {
  const actor = await fromUuid(button.dataset.actor);
  const item = shieldOf(actor);
  if (!actor?.isOwner || !item) {
    return;
  }

  const { rollTest } = await import("../../mechanics/resources/grants.mjs");
  const { success } = await rollTest(actor, 'technology', repairDif(actor));
  if (!success) {
    await post(actor, T('E20.Gij2ShieldRepairFailed', { name: actor.name, shield: item.name }));
    return;
  }

  await actor.unsetFlag('essence20', BROKEN_FLAG);
  if (item.system?.resource?.max != null) {
    await item.update({ 'system.resource.value': item.system.resource.max });
  }

  await post(actor, T('E20.Gij2ShieldRepaired', { name: actor.name, shield: item.name }));
});
