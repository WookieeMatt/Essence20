/**
 * Shared bits for the pr2 slice (Beneath the Helmet, Finster's Monster-Matic Cookbook and PR CRB
 * leftovers). Reuses zord1/common.mjs's light helpers rather than growing a third copy.
 */
import { bth, sourceOf, itemsOf, findSourced } from "./personal-power-allies.mjs";

export { sourceOf, itemsOf, findSourced };

export const PR2 = {
  instructor: bth('zitiiHIQ4miPU5pa'),
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

/** The weapon a weaponEffect hangs off, or null. */
export function parentOf(actor, item) {
  const parentId = item?.flags?.essence20?.parentId;
  return parentId ? itemsOf(actor).find(i => i.id == parentId) ?? null : null;
}

/** The Game Master's client does the world writes (one GM, so nothing runs twice). */
export const isActiveGm = () => {
  const g = globalThis.game;
  return !!g?.user?.isGM && (!g.users?.activeGM || g.users.activeGM.id == g.user.id);
};
