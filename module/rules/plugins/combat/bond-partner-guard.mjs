// Rules-engine plug-ins, round 16 (part b - docs/rules-batches/slLeftB16.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { bondOf } from "../../../mechanics/companions/bonded-partners.mjs";
import { registerDefenseAdjust, registerRollSources } from "../../../mechanics/item-hooks.mjs";
import { ruleId, ruleLabel, rulesOfType } from "../../index.mjs";
import { linkedEntries } from "../../links.mjs";
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { RULE_TYPES, SCOPES } from "../../types.mjs";
import { shiftsOf } from "../../adapter.mjs";

/**
 * Guarding a bonded partner (Hit Someone Your Own Size! - mechanics/companions/bonded-partners.mjs keeps the bond):
 *
 *  - RollModifier `scope: "bondPartnerIncoming"` - on the bond holder's item: rolls made AGAINST its bonded partner, by
 *    anyone but the holder (self: = the roller, holder: = the bond holder, target: = the partner). A labelled source in the
 *    roller's dialog.
 *  - Defense `mode: "holderBest"` (with `scope: bondPartner`) - per attack, the partner meets the better of its own sheet
 *    total of that Defense and the holder's ("can use your Toughness Defense instead of their own"), while `when` holds
 *    (self: = the partner, holder: = the holder, target: = the attacker). Never on the sheet.
 *  - Tags `target:inHolderReach` - the other party's token is within the holder's natural Reach (5 ft per token width);
 *    `self:nearHolder:<ft>` - this actor's token is within that many feet of the holder's. Off the canvas: false.
 */

const sameActor = (a, b) => !!a && !!b && (a === b || (!!a.uuid && a.uuid == b.uuid));
const tokenOf = actor => actor?.getActiveTokens?.()?.[0] ?? null;

function feetBetween(a, b) {
  const ta = tokenOf(a);
  const tb = tokenOf(b);
  if (!ta || !tb || !globalThis.canvas?.grid?.measurePath) {
    return null;
  }

  return globalThis.canvas.grid.measurePath([ta.center, tb.center]).distance;
}

const reachOf = actor => 5 * Math.max(1, Number(tokenOf(actor)?.document?.width) || 1);

registerTag('target:inHolderReach', (rest, ctx) => {
  const holder = ctx?.holder;
  const distance = holder && ctx?.other ? feetBetween(holder, ctx.other) : null;
  return distance !== null && distance <= reachOf(holder);
}, { phrase: ["{who} {is} within its owner's reach", "{who} {isnt} within its owner's reach"] });

registerTag('self:nearHolder', (rest, ctx) => {
  const holder = ctx?.holder;
  const distance = holder && ctx?.self && !sameActor(holder, ctx.self) ? feetBetween(holder, ctx.self) : null;
  return distance !== null && distance <= Number(rest);
}, { phrase: ['{who} {is} within {ft} of its owner', '{who} {isnt} within {ft} of its owner'] });

if (!SCOPES.includes('bondPartnerIncoming')) {
  SCOPES.push('bondPartnerIncoming');
}

if (!RULE_TYPES.RollModifier.scopes.includes('bondPartnerIncoming')) {
  RULE_TYPES.RollModifier.scopes.push('bondPartnerIncoming');
}

/** The bond holder guarding this actor (it is the partner of a bond whose holder isn't itself), or null. */
function guardOf(target) {
  const bond = bondOf(target);
  return bond && sameActor(bond.partner, target) && !sameActor(bond.holder, target) ? bond.holder : null;
}

/** bondPartnerIncoming RollModifiers on rolls against a guarded partner. */
export function bondGuardSources(actor, target, ctx = {}) {
  const holder = target ? guardOf(target) : null;
  if (!holder || sameActor(holder, actor)) {
    return { sources: [], consumes: [] };
  }

  const isAttack = ctx.isAttack ?? ctx.item?.type == 'weaponEffect';
  const facts = { ...ctx, isAttack, isMelee: ctx.isMelee ?? (isAttack && ctx.item?.system?.classification?.style == 'melee') };
  const sources = [];
  for (const { rule, item, index } of rulesOfType(holder, 'RollModifier', 'bondPartnerIncoming')) {
    if (evaluate(rule.when, contextFor({ ...facts, self: actor, holder, other: target, ruleItem: item })) !== true) {
      continue;
    }

    const shifts = shiftsOf(rule, holder, item, undefined, target, ctx.item);
    if (shifts.shiftUp || shifts.shiftDown || shifts.edge || shifts.snag) {
      sources.push({ id: `${ruleId(item, index)}-bond`, label: ruleLabel(rule, item), ...shifts });
    }
  }

  return { sources, consumes: [] };
}

registerRollSources(bondGuardSources);

if (!RULE_TYPES.Defense.params.mode.options.includes('holderBest')) {
  RULE_TYPES.Defense.params.mode.options.push('holderBest');
}

/** Defense holderBest: what to add so the partner meets the better of its own and its holder's Defense. */
export function holderBestAdjust(attacker, defender, defenseType) {
  let best = 0;
  for (const { rule, item, holder } of defender ? linkedEntries(defender, 'Defense') : []) {
    if (rule.mode != 'holderBest' || (rule.defense != 'any' && rule.defense != defenseType) || !holder) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ self: defender, holder, ruleItem: item, other: attacker, defenseType })) !== true) {
      continue;
    }

    const mine = Number(defender.system?.defenses?.[defenseType]?.total) || 0;
    const theirs = Number(holder.system?.defenses?.[defenseType]?.total) || 0;
    best = Math.max(best, theirs - mine);
  }

  return best;
}

registerDefenseAdjust((attacker, defender, defenseType) => holderBestAdjust(attacker, defender, defenseType));
