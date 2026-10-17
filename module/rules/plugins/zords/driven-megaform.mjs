// Rules-engine plug-ins, round 18 (convB - docs/rules-batches/slConvB18.md): the drivenMegaform link scope and the
// megaform:everyDriver tag. Registered on import; see module/rules/plugins/index.mjs. Plain Node safe.
import { registerLinkScope } from "../../links.mjs";
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { RULE_TYPES, SCOPES } from "../../types.mjs";
import { driverOf, isCombinerForm, rosterOf } from "../shared/zord-crew-lookups.mjs";

/**
 * Scope `drivenMegaform` - a rule on a character's item reaches every Megazord the Zord it drives is part of: the
 * Megaform's Zord participants' drivers are its holders (a Combiner form has none - its participants aren't Zords). Taken
 * by every rule type that takes `vehicle`. `stacks: false` counts one book item once however many drivers hold it.
 *
 * Tag `megaform:everyDriver:<tags joined by &>` - this actor is a Megazord with at least one Zord participant, and every
 * one of them has a driver for whom the tags hold, asked as `self:` (the driver; `holder:` stays the rule's holder).
 * Zeo Crystal Boost's team clause: `megaform:everyDriver:self:data:flags.essence20.zeoCrystalBoostOption=megaformTeam`.
 */

/** A Megazord's Zord participants (a Combiner form has none). */
export function zordParticipants(megaform) {
  return megaform?.type == 'megaform' && !isCombinerForm(megaform) && !!megaform.system?.subtype?.includes?.('megaformZord')
    ? rosterOf(megaform).filter(actor => actor?.type == 'zord') : [];
}

registerLinkScope('drivenMegaform', actor => [...new Set(zordParticipants(actor).map(driverOf).filter(Boolean))]);

if (!SCOPES.includes('drivenMegaform')) {
  SCOPES.push('drivenMegaform');
}

for (const definition of Object.values(RULE_TYPES)) {
  if (definition.scopes?.includes('vehicle') && !definition.scopes.includes('drivenMegaform')) {
    definition.scopes.push('drivenMegaform');
  }
}

registerTag('megaform:everyDriver', (rest, ctx) => {
  const zords = zordParticipants(ctx.self);
  if (!zords.length) {
    return false;
  }

  const tags = String(rest ?? '').split('&').filter(Boolean);
  return zords.every(zord => {
    const driver = driverOf(zord);
    return !!driver && evaluate(tags, contextFor({ self: driver, holder: ctx.holder ?? null, ruleItem: ctx.ruleItem ?? null })) === true;
  });
}, { phrase: (arg, w) => [`every Zord in it has a driver where ${w.facts(arg.split('&'), 'the driver', 'self')}`, `not every Zord in it has a driver where ${w.facts(arg.split('&'), 'the driver', 'self')}`] });
