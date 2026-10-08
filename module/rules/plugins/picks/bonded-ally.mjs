// Rules-engine plug-ins, round 17 (split3 - docs/rules-batches/slSplit317.md): the bonded ally as a recipient.
// Registered on import; see module/rules/plugins/index.mjs.
import { bondedAlly } from "../../../mechanics/companions/bonded-partners.mjs";
import { registerTag } from "../../predicate.mjs";
import { registerRecipient } from "../../steps.mjs";

/**
 * Headmasters, Powermasters and Targetmasters keep their bond on the Perk holder (mechanics/companions/bonded-partners.mjs).
 *
 *   recipient `bondedAlly`   the other side of the actor's bond, linked or not (bonded-partners.mjs#bondedAlly) - nobody
 *                            when it has none.
 *   tag `self:bonded`        the actor has a bonded ally (either side, linked or not).
 *
 * Synaptic Linkage's Use passes one of the actor's Conditions to it.
 */
registerRecipient('bondedAlly', (match, ctx) => {
  const ally = bondedAlly(ctx.actor);
  return ally ? [ally] : [];
});

registerTag('self:bonded', (rest, ctx) => !!bondedAlly(ctx?.self), { phrase: ['{who} {has} a bonded ally', '{who} {has} no bonded ally'] });
