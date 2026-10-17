// Rules-engine plug-ins for riding in a Transformer's Alt Mode (mechanics/vehicles/alt-mode-crew.mjs). Registered on
// import; see module/rules/plugins/index.mjs.
import { board, carrierOf, disembark, isTransformer, seatOf } from "../../../mechanics/vehicles/alt-mode-crew.mjs";
import { registerLinkScope } from "../../links.mjs";
import { registerTag } from "../../predicate.mjs";
import { recipients, registerStep } from "../../steps.mjs";
import { RULE_TYPES, SCOPES, registerRuleType } from "../../types.mjs";

/**
 * - Rule type `CrewCapacity` {add?, set?, modes?}: the Transformer's Crew rating (TF CRB p.47) - `set` replaces it,
 *   `add` adds to it (formulas). `modes`: alt (default - in an Alt Mode), bot (in Bot Mode; it has none otherwise) or
 *   both. Extra Crew Capacity: +4 in Alt Mode, 1 in Bot Mode.
 * - Rule type `Cage`: it can hold prisoners - up to its Crew rating in Alt Mode, one in Bot Mode (TF CRB p.134).
 * - Scope `passengers` (every rule type that takes `crew` takes it): on the Transformer's item, reaches whoever rides
 *   in its Alt Mode (Emergency Care Equipment's Edge for passengers treating each other).
 * - Tags: self:aboardHolder / target:aboardHolder - that actor rides in the rule's holder; target:aboardHolderOrNone -
 *   the target rides in the holder, or nothing is targeted (a passenger's token is hidden, so treating another
 *   passenger mostly can't target them); self:inAltModeCrew - the actor rides in any Transformer.
 * - Steps `altModeBoard` {role?, to?} (the step's actor is the Transformer; `to` - the target by default - gets in,
 *   as passenger, driver or prisoner, with no Reach check: the Cage's Use) and `altModeDisembark` {to?} (gets them
 *   out). Either stops the steps after it when it doesn't happen.
 */

registerRuleType('CrewCapacity', {
  params: { add: { kind: 'formula' }, set: { kind: 'formula' }, modes: { kind: 'enum', options: ['alt', 'bot', 'both'] } },
  scopes: ['self'],
  validate: rule => (rule.add === undefined && rule.set === undefined ? ['changes nothing (add or set)'] : []),
});

registerRuleType('Cage', { params: {}, scopes: ['self'] });

const sameActor = (a, b) => !!a && !!b && (a === b || (!!a.uuid && a.uuid == b.uuid));

registerLinkScope('passengers', actor => {
  const aboard = carrierOf(actor);
  return aboard ? [aboard.carrier] : [];
});

if (!SCOPES.includes('passengers')) {
  SCOPES.push('passengers');
}

for (const definition of Object.values(RULE_TYPES)) {
  if (definition.scopes?.includes('crew') && !definition.scopes.includes('passengers')) {
    definition.scopes.push('passengers');
  }
}

const holderOf = ctx => ctx.holder ?? ctx.ruleItem?.parent ?? null;
const ridesIn = (actor, holder) => !!actor && !!holder && sameActor(carrierOf(actor)?.carrier, holder);

registerTag('self:aboardHolder', (rest, ctx) => ridesIn(ctx.self, holderOf(ctx)),
  { phrase: ['{who} {is} riding inside its owner', "{who} {isnt} riding inside its owner"] });
registerTag('target:aboardHolder', (rest, ctx) => ridesIn(ctx.other, holderOf(ctx)),
  { phrase: ['{who} {is} riding inside its owner', "{who} {isnt} riding inside its owner"] });
registerTag('target:aboardHolderOrNone', (rest, ctx) => !ctx.other || ridesIn(ctx.other, holderOf(ctx)),
  { phrase: ['{who} {is} riding inside its owner (or nobody is targeted)', "{who} {isnt} riding inside its owner"] });
registerTag('self:inAltModeCrew', (rest, ctx) => !!carrierOf(ctx.self),
  { phrase: ["{who} {is} riding inside a Transformer's Alt Mode", "{who} {isnt} riding inside a Transformer's Alt Mode"] });

const ROLES = ['driver', 'passenger', 'prisoner'];

registerStep('altModeBoard', async (step, ctx) => {
  if (!isTransformer(ctx.actor)) {
    return false;
  }

  const riders = recipients({ ...step, to: step.to ?? 'target' }, ctx);
  if (!riders.length) {
    return false;
  }

  for (const rider of riders) {
    if (!(await board(ctx.actor, rider, { role: step.role ?? 'passenger', force: true }))) {
      return false;
    }
  }
}, { errors: (step, where) => (step.role && !ROLES.includes(step.role) ? [`${where}: altModeBoard's role must be driver, passenger or prisoner`] : []) });

registerStep('altModeDisembark', async (step, ctx) => {
  const riders = recipients({ ...step, to: step.to ?? 'target' }, ctx);
  let any = false;
  for (const rider of riders) {
    const carrier = isTransformer(ctx.actor) && seatOf(ctx.actor, rider) ? ctx.actor : carrierOf(rider)?.carrier;
    any = (carrier && await disembark(carrier, rider, { force: true })) || any;
  }

  return any ? undefined : false;
});
