/**
 * Shared bits for the pr2 slice (Beneath the Helmet, Finster's Monster-Matic Cookbook and PR CRB
 * leftovers). Reuses zord1/common.mjs's light helpers rather than growing a third copy.
 */
import { worldActors } from "../../companion-link.mjs";
import { bth, pack, prcrb, sourceOf, itemsOf, findSourced } from "../zord1/common.mjs";

export { sourceOf, itemsOf, findSourced };

const fmmc = pack('finster_s_monster_matic_cookbook');

export const PR2 = {
  bendPhysics: bth('EITAjh6GBuc2SVSY'),
  primalRage: bth('4gkRa5plNeMNXSmL'),
  instructor: bth('zitiiHIQ4miPU5pa'),
  graphitePrime: bth('nVOpdhr6aFnuY0ks'),
  privileged: bth('J8kK8oU2rF7eWTRc'),
  dedicatedCarrier: bth('GShizr9G3xrMB3O5'),
  dinoDriveMode: bth('fpfH5KgJ3BdWAFtM'),
  dinoGemIntegration: bth('q9lciavy0Nfh0rR8'),
  energemInfusion: bth('ZLQCeC2gGWHnYEBQ'),
  combiner: prcrb('ZZMBVjmosr0VViMU'),
  carrier: prcrb('h1b0cjGJP1xqtfVv'),
  aimApparatus: prcrb('8Kyl6XMzRCZGBzbW'),
  keenEye: prcrb('Z4YwTrUSDQIrDkQT'),
  gridRelicWeapon: prcrb('82Ld65NsKwfMZaSC'),
  auraOfDecay: fmmc('Vza1muNXrpw4IyKG'),
  flamesOfHateWeapon: fmmc('ogROcCjAwDs7iTXl'),
  flamesOfHateEffects: [fmmc('NM8MYrneenCTTaPZ'), fmmc('C2A6ZgisRQBnlXMZ')],
  incinerationBlastWeapon: fmmc('vhEMHZasM90vmoJN'),
  incinerationBlastEffect: fmmc('q415Hdvrl2rrCu9y'),
};

/** A localized string - keys live in scratchpad integration/pr2-lang.json as E20.<key>. */
export const T = (key, data) => {
  const full = `E20.${key}`;
  const i18n = globalThis.game?.i18n;
  if (!i18n) {
    return full;
  }

  return data ? i18n.format(full, data) : i18n.localize(full);
};

export const holds = (actor, uuid) => !!uuid && itemsOf(actor).some(item => sourceOf(item) == uuid);

/**
 * "Your Power Ranger team" - every Player Character in the world, the same reading
 * helpers/team-member-picker.mjs's own build-time picker uses (there's no roster to trust).
 */
export function teamOf(actor) {
  if (actor?.type != 'playerCharacter') {
    return [];
  }

  const others = worldActors().filter(a => a?.type == 'playerCharacter' && a.id != actor.id);
  return [actor, ...others];
}

/** Whether the actor, or anyone on their team, holds the item. */
export const teamHolds = (actor, uuid) => teamOf(actor).some(member => holds(member, uuid));

/** The weapon a weaponEffect hangs off, or null. */
export function parentOf(actor, item) {
  const parentId = item?.flags?.essence20?.parentId;
  return parentId ? itemsOf(actor).find(i => i.id == parentId) ?? null : null;
}

export const isRangedAttack = item => item?.type == 'weaponEffect' && item.system?.classification?.style != 'melee';

/** The Game Master's client does the world writes (one GM, so nothing runs twice). */
export const isActiveGm = () => {
  const g = globalThis.game;
  return !!g?.user?.isGM && (!g.users?.activeGM || g.users.activeGM.id == g.user.id);
};
