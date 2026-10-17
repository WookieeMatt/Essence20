/**
 * Shared bits for the zord1 extension modules (Forms, Emotional Mastery, Zord Feature slots,
 * Megaforms, size/mode items): their compendium packs, Personal Power spend/gain, the Edge helper
 * and the Ranger weapon checks. Light on purpose: nothing heavy is imported at top level. The
 * generic lookups, lang, chat, stamp and relayed-write helpers live in item-lookups.mjs,
 * item-lang.mjs, chat-lines.mjs, turn-stamps.mjs and relayed-writes.mjs.
 */
import { TSafe as T } from "./item-lang.mjs";
import { itemsOfAny } from "./item-lookups.mjs";
import { writeDoc } from "./relayed-writes.mjs";

export const pack = name => id => `Compendium.essence20.${name}.Item.${id}`;
export const jtt = pack('jump_through_time');
export const ats = pack('across_the_stars');
export const bth = pack('beneath_the_helmet');
export const cc = pack('cobra_codex');
export const dsoe = pack('dark_skies_over_equestria');
export const dd = pack('decepticon_directive');
export const fgaa = pack('field_guide_action_adventure');
export const prcrb = pack('pr_crb');

/* -------------------------------------------- */
/*  Personal Power                               */
/* -------------------------------------------- */

export function personalPower(actor) {
  return Number(actor?.system?.powers?.personal?.value) || 0;
}

/** Spend n Personal Power; false (and a warning) if the actor can't afford it. */
export async function spendPower(actor, n = 1) {
  if (n <= 0) {
    return true;
  }

  if (personalPower(actor) < n) {
    globalThis.ui?.notifications?.warn(T('Zord1NoPower', { name: actor?.name ?? '', n }));
    return false;
  }

  await writeDoc(actor, 'update', [{ 'system.powers.personal.value': personalPower(actor) - n }]);
  return true;
}

export async function gainPower(actor, n) {
  const max = Number(actor?.system?.powers?.personal?.max);
  const next = personalPower(actor) + n;
  await writeDoc(actor, 'update', [{ 'system.powers.personal.value': Number.isFinite(max) && max > 0 ? Math.min(max, next) : next }]);
}

/* -------------------------------------------- */
/*  Rolls and weapons                            */
/* -------------------------------------------- */

/** The option-object Edge helper the dialog appliers share: Edge cancels a Snag first. */
export function giveEdge(options) {
  if (options.snag) {
    options.snag = false;
  } else {
    options.edge = true;
  }
}

/** The weapon a weaponEffect hangs off (null for an unarmed attack). */
export function parentWeaponOf(actor, item) {
  if (item?.type != 'weaponEffect') {
    return null;
  }

  const parentId = item.flags?.essence20?.parentId;
  return parentId ? actor?.items?.get?.(parentId) ?? itemsOfAny(actor).find(i => i.id == parentId) ?? null : null;
}

export const isBladeBlaster = weapon => !!weapon?.name?.includes?.('Blade Blaster');
export const isPowerWeapon = weapon => !isBladeBlaster(weapon) && !!weapon?.system?.traits?.includes?.('powerWeapon');
