import { registerDamageModifier } from "../../../helpers/extensions.mjs";
import { formulaError, resolveValue } from "../../formula.mjs";
import { ruleLabel, rulesOfType } from "../../index.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerEvent, registerRuleType } from "../../types.mjs";
import { dispositionOf, escape, localize, sceneActors, T } from "./common.mjs";

/**
 * Group H rule types read by hand-written hooks, and one event.
 *
 * - `InitiativeEdge {}` - Edge on an Initiative roll (dice.mjs INITIATIVE_EXTENSIONS, after the dialog). Scope `self`: the
 *   holder's own; scope `sceneAllies`: every OTHER actor on the holder's side (same token disposition - the active token's,
 *   else the prototype's) while the holder has a token on the viewed scene. `when` is asked with self = the roller and
 *   holder = the rule's holder. Read at roll time, never in derived data (other tokens' actors aren't touched while one
 *   prepares).
 * - `GrantDouble {grants: [upshift | actions], prompt?, damage?: {amount, type}}` - when the holder grants another actor
 *   upshifts on a banked bonus (helpers/perks.mjs#bankPendingBonus) or extra actions this turn
 *   (helpers/action-economy.mjs#grantActionsThisTurn), the holder is asked; yes doubles the grant and deals `damage` to the
 *   one receiving it. `prompt` (an E20. key or text) fills {granter}, {ally}, {what}. `when`: self = the granter,
 *   target = the ally. Never for the holder granting themselves.
 * - `DamageReduction {amount, damageTypes?, limit?, message?}` - damage about to land on the holder (an extensions damage
 *   modifier) of one of those types is lowered by `amount` (a formula - 1d2 rolls), never below 0; `limit` counts uses
 *   ({per: round} - outside a combat a round limit never runs out, as the combat-stamped helpers read it). `message` (an E20.
 *   key or text, {name} and {n}) is posted. `when` sees the holder.
 * - Event `massShiftUsed` - the Mass Shift Role Perk was used (helpers/mass-shift.mjs#activateMassShift).
 */

/* -------------------------------------------- */
/*  InitiativeEdge                               */
/* -------------------------------------------- */

registerRuleType('InitiativeEdge', { params: {}, scopes: ['self', 'sceneAllies'] });

const sameActor = (a, b) => a === b || (!!a?.id && a.id == b?.id) || (!!a?.uuid && a.uuid == b?.uuid);

/** Whether an Initiative roll by `actor` gets Edge from its own or a scene ally's InitiativeEdge rule. */
export function initiativeEdgeFor(actor, others = sceneActors()) {
  if (!actor) {
    return false;
  }

  const holds = (holder, scope) => rulesOfType(holder, 'InitiativeEdge', scope)
    .some(({ rule, item }) => evaluate(rule.when, contextFor({ self: actor, holder, ruleItem: item })) === true);
  if (holds(actor, 'self')) {
    return true;
  }

  const seen = new Set();
  for (const other of others) {
    if (!other || sameActor(other, actor) || seen.has(other) || dispositionOf(other) != dispositionOf(actor)) {
      continue;
    }

    seen.add(other);
    if (holds(other, 'sceneAllies')) {
      return true;
    }
  }

  return false;
}

export async function initiativeEdge(actor, options) {
  if (options && initiativeEdgeFor(actor)) {
    options.edge = true;
  }
}

globalThis.Hooks?.once?.('init', async () => {
  const dice = await import("../../../dice.mjs");
  dice.INITIATIVE_EXTENSIONS?.push(initiativeEdge);
});

/* -------------------------------------------- */
/*  GrantDouble                                  */
/* -------------------------------------------- */

export const GRANT_KINDS = ['upshift', 'actions'];

registerRuleType('GrantDouble', {
  params: { grants: { kind: 'strings', required: true }, prompt: { kind: 'string' }, damage: { kind: 'object' } },
  scopes: ['self'],
  validate: rule => [
    ...(Array.isArray(rule.grants) && rule.grants.length && rule.grants.every(kind => GRANT_KINDS.includes(kind)) ? [] : [`grants must list some of ${GRANT_KINDS.join(', ')}`]),
    ...(rule.damage !== undefined && (!rule.damage?.type || formulaError(rule.damage?.amount ?? 1)) ? ['damage needs {amount, type}'] : []),
  ],
});

/** The granter's GrantDouble rule for this kind of grant to that ally, or null. */
export function grantDoubleRule(granter, ally, kind) {
  if (!granter || !ally || granter === ally || (granter.uuid && granter.uuid == ally.uuid)) {
    return null;
  }

  return rulesOfType(granter, 'GrantDouble').find(({ rule, item }) => (rule.grants ?? []).includes(kind)
    && evaluate(rule.when, contextFor({ self: granter, holder: granter, other: ally, ruleItem: item })) === true) ?? null;
}

/**
 * Ask the granter whether to double what they grant the ally (`what` names it in the prompt). On a yes the rule's damage
 * lands on the ally. Resolves whether to double.
 */
export async function offerGrantDouble(granter, ally, kind, what) {
  const entry = grantDoubleRule(granter, ally, kind);
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!entry || !DialogV2?.confirm) {
    return false;
  }

  const { rule, item } = entry;
  const data = { granter: granter.name, ally: ally.name, what };
  const prompt = rule.prompt ? localize(rule.prompt, data) : T('DoublePrompt', data);
  // Bound: DialogV2.confirm calls this.wait internally.
  const yes = await DialogV2.confirm.call(DialogV2, {
    window: { title: item?.name ?? ruleLabel(rule, item) },
    content: `<p>${prompt}</p>`,
    rejectClose: false,
  });
  if (!yes) {
    return false;
  }

  if (rule.damage?.type) {
    const amount = Math.round(resolveValue(rule.damage.amount ?? 1, { actor: granter, item, other: ally }, 1));
    const { applyDamage } = await import("../../../helpers/combat.mjs");
    await applyDamage(ally, amount, rule.damage.type);
  }

  return true;
}

/* -------------------------------------------- */
/*  DamageReduction                              */
/* -------------------------------------------- */

registerRuleType('DamageReduction', {
  params: { amount: { kind: 'formula', required: true }, damageTypes: { kind: 'strings' }, limit: { kind: 'object' }, message: { kind: 'string' } },
  scopes: ['self'],
  validate: rule => (rule.limit !== undefined && !['turn', 'round', 'scene', 'encounter', 'mission'].includes(rule.limit?.per)
    ? ['limit.per must be turn, round, scene, encounter or mission'] : []),
});

/** Damage about to land on `actor` after its DamageReduction rules. */
export async function damageReduction(actor, amount, damageType) {
  let value = amount;
  for (const { rule, item, index } of rulesOfType(actor, 'DamageReduction')) {
    if (!(value > 0)) {
      break;
    }

    if ((rule.damageTypes?.length && !rule.damageTypes.includes(damageType)) || usesLeft(actor, rule, item, index) <= 0
      || evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item, damageType })) !== true) {
      continue;
    }

    const n = Math.max(0, Math.round(resolveValue(rule.amount, { actor, item }, 0)));
    await recordUse(actor, rule, item, index);
    const line = rule.message ? localize(rule.message, { name: actor.name, n }) : T('Reduced', { name: actor.name, n, item: item?.name ?? '' });
    if (globalThis.ChatMessage?.create) {
      await globalThis.ChatMessage.create({ speaker: globalThis.ChatMessage.getSpeaker?.({ actor }), content: `<p>${escape(line)}</p>` });
    }

    value = Math.max(0, value - n);
  }

  return value;
}

registerDamageModifier((actor, amount, damageType) => damageReduction(actor, amount, damageType));

/* -------------------------------------------- */
/*  massShiftUsed                                */
/* -------------------------------------------- */

registerEvent('massShiftUsed');

export async function massShiftUsed(actor) {
  const { fireTriggers } = await import("../../triggers.mjs");
  await fireTriggers(actor, 'massShiftUsed');
}
