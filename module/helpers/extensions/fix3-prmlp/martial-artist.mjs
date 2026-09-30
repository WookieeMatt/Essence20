import { registerApplyDialog, registerDialogToggles } from "../../extensions.mjs";

/**
 * Martial Artist Hang-Up (PR CRB p.70 / GI Joe CRB p.50, same text in both): "attempts to goad you
 * into action with Social abilities gain an Edge against you." Only the roller knows whether a
 * Social test is trying to goad the holder, so this is a Roll Options Dialog switch (off by
 * default) on Social-Essence rolls made while a Martial Artist is targeted, not an automatic Edge.
 */

const PR_ID = "Compendium.essence20.pr_crb.Item.hXKy7kWGic6wSge9";
const GIJ_ID = "Compendium.essence20.gi_joe_crb.Item.rIIL4yvym7KUCUyH";
export const MARTIAL_ARTIST_HANGUP_IDS = [PR_ID, GIJ_ID];

const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource;

function itemsOf(actor) {
  const items = actor?.items;
  return Array.isArray(items?.contents) ? items.contents : (items && typeof items[Symbol.iterator] == 'function' ? [...items] : []);
}

/** The targeted actor's Martial Artist Hang-Up, or null. */
export function targetMartialArtist(target) {
  return itemsOf(target).find(item => item.type == 'hangUp' && MARTIAL_ARTIST_HANGUP_IDS.includes(sourceOf(item))) ?? null;
}

function label(name) {
  const key = 'E20.Fix3MartialArtistGoadToggle';
  const i18n = globalThis.game?.i18n;
  if (i18n?.has?.(key)) {
    return i18n.format(key, { name });
  }

  return `${name}: Edge (tick if this is goading them into action)`;
}

export function martialArtistToggles(actor, { rolledSkill, rolledEssence } = {}) {
  const essence = rolledEssence ?? globalThis.CONFIG?.E20?.skillToEssence?.[rolledSkill];
  if (essence != 'social') {
    return [];
  }

  const target = globalThis.game?.user?.targets?.first?.()?.actor;
  const hangUp = target && target !== actor ? targetMartialArtist(target) : null;
  if (!hangUp) {
    return [];
  }

  return [{ name: 'martialArtistGoad', type: 'checkbox', label: label(hangUp.name ?? 'Martial Artist'), value: false }];
}

export function martialArtistApplyDialog(actor, options) {
  if (options.ext?.martialArtistGoad) {
    if (options.snag) {
      options.snag = false;
    } else {
      options.edge = true;
    }
  }
}

registerDialogToggles(martialArtistToggles);
registerApplyDialog(martialArtistApplyDialog);
