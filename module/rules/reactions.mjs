import { registerChatDecorator } from "../helpers/extensions.mjs";
import { canAct, cardInfo, claim, claimKey, isClaimed, isNegated, placeFor, areAllies, distanceBetween } from "../helpers/extensions/react/core.mjs";
import { ruleId, ruleLabel, rulesOfType } from "./index.mjs";
import { recordUse, usesLeft } from "./limits.mjs";
import { contextFor, evaluate } from "./predicate.mjs";
import { resolveValue } from "./formula.mjs";
import { canAfford, changeResource, runSteps, stepContext } from "./steps.mjs";

/**
 * Reaction rules: a button on a posted check card (an attack, or any roll against a Defense) for
 * whoever the rule says may answer it - the one it targeted, the attacker, an ally of either, an
 * enemy of the attacker. Pressing it pays the rule's resource cost and runs its steps, which can
 * change the card: negateHit, lowerTotal, lateSnag, convertRows (rules/steps.mjs). Built on the react
 * slice's card reading (helpers/extensions/react/core.mjs), so a hit a rule cancels is cancelled the
 * same way a hand-written reaction cancels it.
 *
 *   who        target (default) | attacker | allyOfTarget | allyOfAttacker | enemyOfAttacker
 *   within     feet from the one it's measured against (allyOf*: that creature; else: unlimited)
 *   per        row (one button per target row, the default) | card (one for the whole card)
 *   outcome    any (default) | hit | miss - the row's (a card: some row's) result
 *   attackOnly only weapon attacks
 *   minMargin / maxMargin   the card's total minus the row's DIF must be at least / at most this
 *   cost       {resource, amount}; limit as everywhere
 *
 * Steps see @var.total, @var.dif, @var.margin and @var.damage (the row's damage); `target` is the
 * other side - the attacker for the defender's side, the row's target for the attacker's side.
 */

export const REACTION_WHO = ['target', 'attacker', 'allyOfTarget', 'allyOfAttacker', 'enemyOfAttacker'];

const lookup = uuid => (uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null);

/**
 * Plug-in reactor lookups (module/rules/ext/*): a `who` whose answerers aren't the canvas tokens holding the rule (a
 * Megaform participant's pilot, off the canvas). `find(info, row)` - row null for a card-wide rule - returns
 * [{actor, item, rule, index, holder?}]: who may answer and with which of the holder's rules.
 */
export const REACTOR_LOOKUPS = new Map();
export function registerReactorLookup(who, find) {
  REACTOR_LOOKUPS.set(who, find);
  if (!REACTION_WHO.includes(who)) {
    REACTION_WHO.push(who);
  }
}

/** Every lookup's answerers, per row (per: card rules for the whole card). */
function lookedUpEntries(info) {
  const out = [];
  for (const [who, find] of REACTOR_LOOKUPS) {
    for (const row of [...info.rows.filter(r => r.targetUuid), null]) {
      for (const entry of find(info, row) ?? []) {
        if (entry?.actor && entry.rule?.who == who && (entry.rule.per == 'card') == (row === null)) {
          out.push({ ...entry, holder: entry.holder ?? entry.actor, rows: [row], looked: true });
        }
      }
    }
  }

  return out;
}

/** Actors on the canvas with Reaction rules. */
function reactingActors() {
  const found = new Set();
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    if (token?.actor && rulesOfType(token.actor, 'Reaction').length) {
      found.add(token.actor);
    }
  }

  return [...found];
}

function inRange(a, b, feet) {
  return !(Number(feet) > 0) || distanceBetween(a, b) <= Number(feet);
}

/** Whether `actor` is on the side the rule answers from, for this row. */
function onSide(rule, actor, info, rowTarget) {
  const attacker = info.attacker;
  switch (rule.who ?? 'target') {
  case 'attacker': return actor === attacker;
  case 'allyOfTarget': return !!rowTarget && actor !== rowTarget && areAllies(actor, rowTarget) && inRange(actor, rowTarget, rule.within);
  case 'allyOfAttacker': return !!attacker && actor !== attacker && areAllies(actor, attacker) && inRange(actor, attacker, rule.within);
  case 'enemyOfAttacker': return !!attacker && actor !== attacker && !areAllies(actor, attacker) && inRange(actor, attacker, rule.within);
  }

  return !!rowTarget && actor === rowTarget;
}

function outcomeHolds(rule, info, row) {
  const rows = row ? [row] : info.rows;
  const live = rows.filter(r => !r.targetUuid || !isNegated(info.message, r.targetUuid));
  switch (rule.outcome ?? 'any') {
  case 'hit': return live.some(r => r.success);
  case 'miss': return rows.some(r => !r.success);
  }

  return row ? live.length > 0 : true;
}

function marginHolds(rule, info, row) {
  const dif = row ? row.difficulty : Math.min(...info.rows.map(r => r.difficulty));
  const margin = info.total - dif;
  return !(rule.minMargin !== undefined && margin < Number(rule.minMargin)) && !(rule.maxMargin !== undefined && margin > Number(rule.maxMargin));
}

/** The vars a Reaction's steps see. */
function varsFor(info, row) {
  const first = row ?? info.rows[0] ?? null;
  const dif = Number(first?.difficulty) || 0;
  return { total: info.total, dif, margin: info.total - dif, damage: Number(first?.damage) || 0, damageType: first?.damageType ?? '' };
}

/**
 * Every Reaction button a card offers: [{actor, item, rule, index, row, other, key}].
 * @param {Object} info   cardInfo(message)
 */
export function reactionOffers(info, actors = reactingActors()) {
  const offers = [];
  if (!info) {
    return offers;
  }

  // Canvas actors' own rules, then the answerers a plug-in reactor lookup finds (their `who` is answered only that way).
  const entries = [];
  for (const actor of actors) {
    for (const entry of rulesOfType(actor, 'Reaction')) {
      if (!REACTOR_LOOKUPS.has(entry.rule.who)) {
        entries.push({ ...entry, actor, holder: actor });
      }
    }
  }

  for (const { actor, rule, item, index, holder, rows: found, looked } of [...entries, ...lookedUpEntries(info)]) {
    if (rule.attackOnly && !info.isAttack) {
      continue;
    }

    const rows = found ?? (rule.per == 'card' ? [null] : info.rows.filter(r => r.targetUuid));
    for (const row of rows) {
      const rowTarget = row ? lookup(row.targetUuid) : lookup(info.rows[0]?.targetUuid);
      if ((!looked && !onSide(rule, actor, info, rowTarget)) || !outcomeHolds(rule, info, row) || !marginHolds(rule, info, row)) {
        continue;
      }

      // The other side of the exchange: the attacker for the defender's side, the row's target for the attacker's.
      const other = ['attacker', 'allyOfAttacker'].includes(rule.who) ? rowTarget : info.attacker;
      const ctx = contextFor({
        self: actor, holder, ruleItem: item, other, item: lookup(info.itemUuid), rolledSkill: info.skill,
        isAttack: info.isAttack, isMelee: info.isMelee,
        // The card's own facts: the Defense the dialog settled on (defense:), the roll's Edge (roll:edge), and the
        // row's hit (damage>=N, damage:crit).
        defenseType: info.defenseType ?? undefined, edge: info.hadEdge,
        ...(row ? { damageAmount: row.damage, damageCrit: row.isCrit, damageType: row.damageType ?? undefined } : {}),
        isFumble: !!info.isFumble,
        vars: varsFor(info, row),
      });
      if (evaluate(rule.when, ctx) !== true || usesLeft(actor, rule, item, index) <= 0) {
        continue;
      }

      const amount = Math.round(resolveValue(rule.cost?.amount ?? 1, { actor, item }, 1));
      if (rule.cost?.resource && !canAfford(rule.cost.resource, amount, { actor, item })) {
        continue;
      }

      offers.push({ actor, item, rule, index, row, other, key: claimKey(info.message, row, ruleId(item, index)) });
    }
  }

  return offers;
}

/**
 * Press one offer: pay, run the steps with the card in hand, record the use and claim the button.
 * @returns {Promise<Boolean>}   Whether it ran.
 */
export async function pressReaction(info, offer) {
  const { actor, item, rule, index, row, other } = offer;
  const ctx = stepContext({ actor, item, rule, targets: other ? [other] : [] });
  ctx.card = { info, row };
  Object.assign(ctx.vars, varsFor(info, row));
  if (rule.cost?.resource) {
    const amount = Math.round(resolveValue(rule.cost.amount ?? 1, { actor, item }, 1));
    if (!(await changeResource(rule.cost.resource, -amount, ctx))) {
      return false;
    }
  }

  const finished = await runSteps(rule.steps ?? [], ctx);
  // A run that stopped (a cancelled choice or roll) is left unclaimed, so the button can be pressed again.
  if (finished === false) {
    return false;
  }

  await recordUse(actor, rule, item, index);
  await claim(actor, offer.key);
  if (ctx.chat.length && globalThis.ChatMessage?.create) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: [`<strong>${ruleLabel(rule, item)}</strong>`, ...ctx.chat].join('<br>') });
  }

  return true;
}

/** Add the Reaction buttons to a rendered check card. */
export function decorateReactionCard(message, element) {
  const info = cardInfo(message);
  if (!info || !element?.querySelectorAll) {
    return;
  }

  for (const offer of reactionOffers(info)) {
    if (!canAct(offer.actor)) {
      continue;
    }

    const button = globalThis.document.createElement('button');
    button.type = 'button';
    button.className = 'e20-chat-action-button e20-react-button';
    button.textContent = `${offer.actor.name}: ${ruleLabel(offer.rule, offer.item)}`;
    button.disabled = isClaimed(offer.actor, offer.key);
    button.addEventListener('click', async event => {
      event.preventDefault();
      if (button.disabled) {
        return;
      }

      button.disabled = true;
      try {
        if (!(await pressReaction(info, offer))) {
          button.disabled = false;
        }
      } catch (error) {
        button.disabled = false;
        console.error('Essence20 | rule reaction failed', error);
      }
    });
    placeFor(element, offer.row).appendChild(button);
  }
}

registerChatDecorator(decorateReactionCard);
