import { RULE_TYPES } from "../../types.mjs";
import { LINK_HOLDERS } from "../../index.mjs";
import { registerLinkScope } from "../../links.mjs";
import { allied } from "../shared/team-and-availability-helpers.mjs";

// Group E (round 10): the `alliesAnywhere` link scope (Inspirational Leader), added to RollModifier. Registered on
// import from picks/picks-and-grants-setup.mjs, before the files whose rules use it.

/**
 * Scope alliesAnywhere: the rule reaches every other actor on the holder's side, anywhere (token dispositions on the
 * canvas, else Player Character or not - react/core.mjs#areAllies), the holder being a world actor.
 */
registerLinkScope('alliesAnywhere', actor => [...LINK_HOLDERS].map(id => globalThis.game?.actors?.get?.(id)).filter(holder => holder && allied(holder, actor)));
for (const type of ['RollModifier']) {
  if (!RULE_TYPES[type].scopes.includes('alliesAnywhere')) {
    RULE_TYPES[type].scopes.push('alliesAnywhere');
  }
}
