// Rules-engine plug-ins, round 14 (items2 - docs/rules-batches/slItems214.md): two small lookups the converted items needed.
// Registered on import; see module/rules/plugins/index.mjs.
import { isItemActive } from "../../index.mjs";
import { registerTag } from "../../predicate.mjs";
import { registerRecipient } from "../../steps.mjs";
import { itemsOf, ownedZords, sourceOf } from "../shared/zord-crew-lookups.mjs";

/**
 * self:holdsActive:<uuid> - the actor holds a copy of that book item which counts for rules (rules/index.mjs#isItemActive: a
 * Hang-Up a Matured Perk ignores doesn't, an unequipped weapon / armor doesn't) - the hand-written actorHasHangUp reading
 * (Laypony Terms on Reverse Engineer's Use). `self:hasItem:<uuid>` counts any copy.
 */
export function holdsActiveTag(rest, ctx) {
  const uuid = String(rest ?? '');
  if (!uuid || !ctx?.self) {
    return false;
  }

  return itemsOf(ctx.self).some(item => (sourceOf(item) == uuid || item.uuid == uuid) && isItemActive(item));
}

/** self:ownsZord - the actor lists a Zord on its sheet (combat.mjs#getOwnedZord finds one). */
export function ownsZordTag(rest, ctx) {
  return ownedZords(ctx?.self).length > 0;
}

registerTag('self:holdsActive', holdsActiveTag, { phrase: ['{poss} {name} is active', "{poss} {name} isn't active"] });
registerTag('self:ownsZord', ownsZordTag, { phrase: ['{who} own{s} a Zord', '{who} {doesnt} own a Zord'] });

// to: "ownZord" - the first Zord listed on the actor's sheet (combat.mjs#getOwnedZord - Zord Alterations' "your Zord");
// "ownZords" (zord-link-scopes.mjs) reaches every one.
registerRecipient('ownZord', (match, ctx) => ownedZords(ctx.actor).slice(0, 1));
