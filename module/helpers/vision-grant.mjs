import { getNearbyAllyTokens } from "./allies.mjs";

/**
 * Picks the vision grant an actor's items actually confer.
 *
 * Extracted from documents/actor.mjs#_prepareVision 2026-09-15, unchanged in behaviour except for
 * Used to the Dark's own doubling clause below - pulled out so that clause could be unit tested
 * directly, the same reason grantDutyOfTheSilverArmorTraining was extracted from setPerkValues.
 *
 * Grants are PICKED, never stacked: the largest range wins. That was always a deliberate
 * simplification (see _prepareVision's own doc comment) rather than an oversight - reconciling two
 * different vision modes has no obvious right answer, and no RAW asks for it.
 */
export const USED_TO_THE_DARK_ID = "Compendium.essence20.cobra_codex.Item.IYN4Bki5gbGXPkki";

/**
 * Vision Focuser's own compendium id (PR CRB, Blue Ranger Grid Tech II pick, p.38) - see the
 * whileMorphed/teamWide fields' own doc comments in data/item/perk.mjs.
 */
export const VISION_FOCUSER_ID = "Compendium.essence20.pr_crb.Item.c2XlLY69AX3laWPh";

/**
 * The best {mode, range} grant among a plain list of items, applying the whileMorphed gate for
 * whichever actor holds each item - factored out so getBestVisionGrant can run it once for the
 * actor's own items and again for a nearby ally's, without duplicating the gating logic.
 * @param {Item[]} items
 * @param {Actor} holder   Whoever these items belong to - checked for Morphed state.
 * @returns {{mode: String, range: Number}|null}
 */
function bestGrantAmong(items, holder) {
  let best = null;
  for (const item of items ?? []) {
    const grant = item.system?.visionGrant;
    if (!grant?.enabled) {
      continue;
    }

    if (item.type == 'gear' && !item.system.equipped) {
      continue;
    }

    if (grant.whileMorphed && !holder?.system?.isMorphed) {
      continue;
    }

    if (!best || grant.range > best.range) {
      best = { mode: grant.mode, range: grant.range };
    }
  }

  return best;
}

/**
 * Used to the Dark (Cobra Codex, Saboteur Influence Perk, p.81): "You can see in darkness up to 30
 * feet as if it was dim light... If you can already see in darkness, such as from the Friend of
 * Darkness Commando Perk, you double the range you can see in the dark."
 *
 * The doubling had nothing to double until Friend of Darkness/Night Eyes were built (2026-09-15) -
 * before that, no other item in any pack granted darkness vision, so this clause was dead text. It
 * applies only when some OTHER item also grants a vision range: Used to the Dark on its own is
 * plainly 30 feet, not 60.
 *
 * The doubled number is the best range on offer, not Used to the Dark's own 30 - RAW doubles "the
 * range you can see in the dark," which is whatever you could already see, so a Night Eyes holder
 * (90) reaches 180 rather than 60.
 * @param {Actor} actor
 * @returns {Object|null}   {mode, range}, or null if nothing grants vision.
 */
export function getBestVisionGrant(actor) {
  let best = null;
  let hasUsedToTheDark = false;
  let otherSources = 0;

  for (const item of actor?.items ?? []) {
    const grant = item.system?.visionGrant;
    if (!grant?.enabled) {
      continue;
    }

    if (item.type == 'gear' && !item.system.equipped) {
      continue;
    }

    if (grant.whileMorphed && !actor?.system?.isMorphed) {
      continue;
    }

    const sourceId = item.flags?.core?.sourceId ?? item._stats?.compendiumSource;
    if (sourceId == USED_TO_THE_DARK_ID) {
      hasUsedToTheDark = true;
    } else {
      otherSources += 1;
    }

    if (!best || grant.range > best.range) {
      best = { mode: grant.mode, range: grant.range };
    }
  }

  // Vision Focuser (PR CRB, Blue Ranger Grid Tech II pick, p.38): "...you and your team can see in
  // darkness..." - a team-wide grant from ANY nearby ally who holds it and is themselves Morphed,
  // the same "any teammate has the Perk" idiom Blaster Focusers/Power Focusers' identical
  // team-wide shape already establishes elsewhere (dice.mjs's own hasTeamWeaponFocusPerk), applied
  // here rather than requiring the RECEIVING actor to hold the Perk itself. Not itself gated on
  // the receiving actor being Morphed (RAW's own "you and your team" reads as the team sharing the
  // Blue Ranger's own tech, not each recipient needing their own Morphed suit) - the same
  // unenforced-precision idiom this codebase already accepts for other team-wide grants.
  for (const token of getNearbyAllyTokens(actor, Infinity)) {
    const allyGrant = bestGrantAmong(
      (token.actor?.items ?? []).filter(item => item.system?.visionGrant?.teamWide), token.actor,
    );
    if (allyGrant && (!best || allyGrant.range > best.range)) {
      best = allyGrant;
      otherSources += 1;
    }
  }

  if (best && hasUsedToTheDark && otherSources > 0) {
    best = { ...best, range: best.range * 2 };
  }

  return best;
}
