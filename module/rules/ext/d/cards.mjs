import { registerChatButton, registerChatDecorator } from "../../../helpers/extensions.mjs";
import { isExpired } from "../../expiry.mjs";
import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { limitKey, recordUse, usesInWindow, usesLeft, LIMIT_WINDOWS } from "../../limits.mjs";
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { canAfford, changeResource, runSteps, stepContext, stepErrors, registerStep } from "../../steps.mjs";
import { registerEvent, registerRuleType } from "../../types.mjs";
import { escape, listOf, say, speakerOf, T, worldActors, write } from "./common.mjs";

/**
 * CardOffer rules - a button on posted roll cards (round 10, group D). The holder's item offers something
 * to do with a roll that has already landed: reroll its d20 / all its dice / its whole formula (keeping the
 * new result, or showing both so the player chooses), add a bonus die to its total, or just run steps
 * ("make it a Fumble"). Who rolled (`whose`), who may press (`pressedBy`), a pool on a mark, a limit, a cost
 * and `when` tags (self: the holder, target: the roller, card: the card) decide when it's offered.
 *
 * {type: CardOffer, label, whose: self | party | side | any, pressedBy: roller | holderOwner | gm,
 *  when?: [tags], pool?: {mark: key}, limit?: {per, max}, counter?: {per}, cost?: {resource, amount},
 *  reroll?: {target: d20 | allDice | formula, keep: new | choose}, addDie?: {faces}, steps?: [...]}
 *
 * Labels fill {count} (what's left in the pool), {cost} and {die}; formulas read @var.used (this rule's uses
 * in its counter / limit window so far).
 */

export const OFFER_WHOSE = ['self', 'party', 'side', 'any'];
export const OFFER_PRESSERS = ['roller', 'holderOwner', 'gm'];

/* -------------------------------------------- */
/*  card: tags                                   */
/* -------------------------------------------- */

const cardFlags = message => message?.flags?.essence20 ?? {};

/** The d20 result on a card's first roll (null with none). */
export function cardD20(message) {
  const die = listOf(message?.rolls?.[0]?.dice).find(d => d.faces == 20);
  return die ? Number(die.total) : null;
}

/** The uuid a holder keeps at a path (flags.essence20.nemesisUuid). */
const storedAt = (actor, path) => String(path ?? '').split('.').reduce((at, key) => at?.[key], actor) ?? null;

/**
 * card:failed (the roll failed), card:fumble (a Fumble), card:d20:<n> (the d20 shows n), card:hasD20, card:checks (it
 * was compared with a DIF or Defense), card:skill (a Skill Test), card:rerolled (it is itself a reroll), card:marked:<key>
 * (an offer's markCard step set it), card:holderPresent (the holder has a token on the viewed scene, or the scene has
 * none), card:involves:<path> (the creature whose uuid the holder keeps at that path is a row's target, or has a token
 * on the viewed scene).
 */
export function cardTag(rest, ctx) {
  const message = ctx.card;
  if (!message) {
    return null;
  }

  const flags = cardFlags(message);
  const [key, ...more] = String(rest).split(':');
  const arg = more.join(':');
  switch (key) {
  case 'failed': return flags.rollFailed === true;
  case 'fumble': return !!flags.isFumble;
  case 'd20': return arg ? cardD20(message) == Number(arg) : cardD20(message) !== null;
  case 'hasD20': return listOf(message.rolls?.[0]?.dice).some(d => d.faces == 20);
  case 'checks': return Array.isArray(flags.checkResults) && flags.checkResults.length > 0;
  case 'skill': return !!flags.skill;
  case 'rerolled': return !!(flags.q1Reroll || flags.ruleReroll);
  case 'marked': return !!flags[arg] || !!flags.ruleCardMarks?.[arg];
  case 'holderPresent': {
    const tokens = listOf(globalThis.canvas?.scene?.tokens);
    const holder = ctx.holder ?? ctx.self;
    return !tokens.length || tokens.some(token => token.actorId == holder?.id);
  }

  case 'involves': {
    const uuid = storedAt(ctx.holder ?? ctx.self, arg);
    if (!uuid) {
      return false;
    }

    const targeted = (flags.checkResults ?? []).some(row => row?.targetUuid && row.targetUuid == uuid);
    return targeted || (globalThis.canvas?.tokens?.placeables ?? []).some(token => token.actor?.uuid == uuid);
  }
  }

  return null;
}

registerTag('card', cardTag, { family: 'situation', param: 'text' });

/* -------------------------------------------- */
/*  The rule type                                */
/* -------------------------------------------- */

function offerErrors(rule) {
  const errors = [];
  if (!rule.reroll && !rule.addDie && !(Array.isArray(rule.steps) && rule.steps.length)) {
    errors.push('a CardOffer needs reroll, addDie or steps');
  }

  if (rule.reroll && !['d20', 'allDice', 'formula'].includes(rule.reroll.target ?? 'd20')) {
    errors.push('reroll.target must be d20, allDice or formula');
  }

  if (rule.reroll && !['new', 'choose'].includes(rule.reroll.keep ?? 'new')) {
    errors.push('reroll.keep must be new or choose');
  }

  if (rule.addDie && rule.addDie.faces === undefined) {
    errors.push('addDie needs faces');
  }

  for (const key of ['limit', 'counter']) {
    if (rule[key] !== undefined && !LIMIT_WINDOWS.includes(rule[key]?.per)) {
      errors.push(`${key}.per must be one of ${LIMIT_WINDOWS.join(', ')}`);
    }
  }

  if (rule.pool !== undefined && !rule.pool?.mark) {
    errors.push('pool needs a mark key');
  }

  if (rule.cost !== undefined && !rule.cost?.resource) {
    errors.push('cost needs a resource');
  }

  if (rule.steps !== undefined) {
    errors.push(...stepErrors(rule.steps));
  }

  return errors;
}

registerRuleType('CardOffer', {
  params: {
    whose: { kind: 'enum', options: OFFER_WHOSE }, pressedBy: { kind: 'enum', options: OFFER_PRESSERS },
    pool: { kind: 'object' }, limit: { kind: 'object' }, counter: { kind: 'object' }, cost: { kind: 'object' },
    reroll: { kind: 'object' }, addDie: { kind: 'object' }, steps: { kind: 'object' },
  },
  scopes: ['self'],
  validate: offerErrors,
});

// rerolled: a reroll card was posted for one of this actor's rolls (a Story Point reroll from chat.mjs, or an
// offer's). @var.source (storyPoint, offer...), @var.total, @var.failed (1 when the new total reaches none of the
// original DIFs), the original roll's Skill as skill:.
registerEvent('rerolled');

/* -------------------------------------------- */
/*  Offers on a card                             */
/* -------------------------------------------- */

/** The primary Party's roster (Best-Laid Plans' "you and your allies"). */
function primaryParty() {
  return listOf(globalThis.game?.actors?.party?.members);
}

const isPcLike = actor => ['playerCharacter', 'companion'].includes(actor?.type);

/** Whether a holder's offer reaches the roller's cards. */
export function reaches(whose, holder, roller) {
  switch (whose ?? 'self') {
  case 'self': return holder === roller || (!!holder?.uuid && holder.uuid == roller?.uuid);
  case 'party': return holder?.uuid == roller?.uuid || primaryParty().some(member => member?.uuid == roller?.uuid);
  case 'side': return !!roller && holder?.uuid != roller.uuid && isPcLike(holder) == isPcLike(roller);
  case 'any': return !!roller;
  }

  return false;
}

/** Whether this user may press an offer. */
export function mayPress(rule, holder, roller, message, user = globalThis.game?.user) {
  switch (rule.pressedBy ?? 'roller') {
  case 'gm': return !!user?.isGM;
  case 'holderOwner': return !!user?.isGM || !!holder?.isOwner;
  }

  return !!user?.isGM || !!roller?.isOwner || !!message?.isAuthor;
}

/** What's left in an offer's pool (a mark's count on the holder), Infinity with none. */
export function poolLeft(rule, holder) {
  if (!rule.pool?.mark) {
    return Infinity;
  }

  const mark = holder?.flags?.essence20?.ruleMarks?.[rule.pool.mark];
  if (!mark || isExpired(mark)) {
    return 0;
  }

  return Number.isFinite(Number(mark.count)) ? Number(mark.count) : 1;
}

/** How many times this offer was used in its counter / limit window. */
export function usedSoFar(rule, holder, item, index) {
  const per = rule.counter?.per ?? rule.limit?.per;
  return per ? usesInWindow(holder, limitKey({ limit: { ...(rule.counter ?? rule.limit), key: rule.limit?.key ?? rule.counter?.key } }, item, index), per) : 0;
}

/** The cost of pressing it now. */
function costOf(rule, holder, item, index) {
  return rule.cost?.resource ? Math.max(0, Math.round(resolveValue(rule.cost.amount ?? 1, { actor: holder, item, vars: { used: usedSoFar(rule, holder, item, index) } }, 1))) : 0;
}

/** A GM Story Point resource ({gmStoryPoints: true}) and the holder's unlimited Role Points. */
async function affordable(rule, holder, item, amount) {
  const resource = rule.cost?.resource;
  if (!resource || !amount) {
    return true;
  }

  if (resource.gmStoryPoints) {
    const { getGmPoints } = await import("../../../helpers/story-points.mjs");
    return getGmPoints() >= amount;
  }

  if (resource.rolePoints && holder?.system?.useUnlimitedResource) {
    return true;
  }

  return canAfford(resource, amount, { actor: holder, item });
}

function affordableNow(rule, holder, item, amount) {
  const resource = rule.cost?.resource;
  if (!resource || !amount || resource.gmStoryPoints || (resource.rolePoints && holder?.system?.useUnlimitedResource)) {
    return true;
  }

  return canAfford(resource, amount, { actor: holder, item });
}

async function pay(rule, holder, item, amount) {
  const resource = rule.cost?.resource;
  if (!resource || !amount) {
    return true;
  }

  if (resource.gmStoryPoints) {
    const { getGmPoints, requestStoryPointSpend } = await import("../../../helpers/story-points.mjs");
    if (getGmPoints() < amount) {
      globalThis.ui?.notifications?.warn?.(T('NoGmPoints'));
      return false;
    }

    await requestStoryPointSpend(null, amount, { pool: 'gm', announce: false });
    return true;
  }

  if (resource.rolePoints && holder?.system?.useUnlimitedResource) {
    return true;
  }

  return changeResource(resource, -amount, { actor: holder, item });
}

/** The die an addDie offer rolls, as "d4". */
function dieOf(rule, holder, item) {
  return `d${Math.max(1, Math.round(resolveValue(rule.addDie?.faces ?? 2, { actor: holder, item }, 2)))}`;
}

/** Fill an offer label's {count}, {cost}, {die} and {holder}. */
function labelOf(rule, holder, item, index) {
  const text = rule.label || item?.name || '';
  const left = poolLeft(rule, holder);
  return text.replace(/\{count\}/g, Number.isFinite(left) ? String(left) : '')
    .replace(/\{cost\}/g, String(costOf(rule, holder, item, index)))
    .replace(/\{die\}/g, rule.addDie ? dieOf(rule, holder, item) : '')
    .replace(/\{holder\}/g, holder?.name ?? '');
}

/**
 * The offers a card carries for this user: [{holder, item, index, rule, label}].
 * @param {ChatMessage} message
 * @param {Array<Actor>} [actors]   Who may hold an offer (every world actor).
 */
export function offersFor(message, actors = worldActors(), user = globalThis.game?.user) {
  if (!message?.rolls?.length) {
    return [];
  }

  const roller = speakerOf(message);
  const found = [];
  for (const holder of actors) {
    for (const { rule, item, index } of rulesOfType(holder, 'CardOffer')) {
      if (!reaches(rule.whose, holder, roller) || !mayPress(rule, holder, roller, message, user)) {
        continue;
      }

      if (poolLeft(rule, holder) <= 0 || usesLeft(holder, rule, item, index) <= 0) {
        continue;
      }

      if (!affordableNow(rule, holder, item, costOf(rule, holder, item, index))) {
        continue;
      }

      if (evaluate(rule.when, contextFor({ self: holder, holder, other: roller, ruleItem: item, card: message })) !== true) {
        continue;
      }

      found.push({ holder, item, index, rule, label: labelOf(rule, holder, item, index) });
    }
  }

  return found;
}

/* -------------------------------------------- */
/*  Pressing one                                 */
/* -------------------------------------------- */

const lookup = uuid => (uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null);

/** A reroll of the card's own roll as a fresh check card (d20 / all dice). */
async function rerollCheck(message, target, label) {
  const { applyReroll } = await import("../../../helpers/reroll.mjs");
  const rerolled = globalThis.Roll.fromData(message.rolls[0].toJSON());
  if (!(await applyReroll(rerolled, { mode: 'all', target, recursive: false, values: [] }))) {
    return null;
  }

  const { buildCheckChatData } = await import("../../../helpers/combat.mjs");
  const flags = cardFlags(message);
  const chatData = await buildCheckChatData(rerolled, {
    flavor: label, results: [], speaker: message.speaker, canCritD2: !!flags.canCritD2,
    rollContext: { skill: flags.skill, essence: flags.essence, q1Reroll: true },
  });
  await globalThis.ChatMessage.create(chatData);
  return rerolled;
}

/** Which DIFs a total meets (the "choose" reroll lists both results against each). */
export function outcomesFor(total, checkResults = []) {
  return checkResults.map(entry => ({ ...entry, success: Number.isFinite(entry?.difficulty) ? total >= entry.difficulty : null }));
}

/** The whole formula again, as a plain roll card - keep: choose lists the old and new totals against every DIF. */
async function rerollFormula(message, keep, holder, label) {
  const roll = await new globalThis.Roll(message.rolls[0].formula).evaluate();
  if (keep != 'choose') {
    await roll.toMessage({ speaker: message.speaker, flavor: label });
    return roll;
  }

  const lines = outcomesFor(roll.total, cardFlags(message).checkResults ?? []).map(row => {
    const name = row.targetUuid ? lookup(row.targetUuid)?.name ?? '?' : T('Difficulty');
    return `<li>${escape(name)} (${row.difficulty}): ${escape(row.success ? T('Success') : T('Failure'))}</li>`;
  }).join('');
  await roll.toMessage({
    speaker: globalThis.ChatMessage.getSpeaker({ actor: holder }),
    flavor: `${escape(T('ChooseFlavor', { name: holder.name, item: label, old: message.rolls[0].total, total: roll.total }))}${lines ? `<ul>${lines}</ul>` : ''}`,
  });
  return roll;
}

/** The card's rows rescored with a bonus added to its total. */
export function rescore(oldTotal, bonus, checkResults, multiplierOf) {
  const total = oldTotal + bonus;
  return (checkResults ?? []).map(entry => ({
    ...entry, total, before: multiplierOf(oldTotal, entry.difficulty), after: multiplierOf(total, entry.difficulty),
  }));
}

/** A bonus die added to the card's total: the new results, and damage for targets it now hits (or hits harder). */
async function addDie(message, die, holder) {
  const roll = await new globalThis.Roll(`1${die}`).evaluate();
  const { computeMultiplier } = await import("../../../helpers/combat.mjs");
  const flags = cardFlags(message);
  const results = rescore(message.rolls[0].total, roll.total, flags.checkResults, computeMultiplier);
  const effect = flags.isAttack && flags.itemUuid ? await globalThis.fromUuid(flags.itemUuid) : null;
  const base = Number(effect?.system?.damageValue) || 0;
  const damageType = effect?.system?.damageType ?? null;
  const localize = key => globalThis.game?.i18n?.localize?.(key) ?? key;
  const rows = [];
  for (const [index, entry] of results.entries()) {
    const target = entry.targetUuid ? await globalThis.fromUuid(entry.targetUuid) : null;
    const name = escape(target?.name ?? T('Check'));
    const outcome = entry.after > 0 ? localize('E20.CheckSuccess') + (entry.after > 1 ? ` &times;${entry.after}` : '') : localize('E20.CheckFailure');
    let row = `<li>${name} (${localize('E20.CheckDifficultyAbbr')} ${entry.difficulty}): ${outcome}</li>`;
    const extra = base * (entry.after - entry.before);
    if (extra > 0 && damageType && target) {
      row += `<button type="button" class="e20-check-damage-button" data-action="apply-damage" data-key="${entry.targetUuid}:ruleAddDie:${index}"
        data-target-uuid="${entry.targetUuid}" data-damage="${extra}" data-damage-type="${damageType}">
        ${localize('E20.CheckApplyDamage')} ${extra} ${localize(globalThis.CONFIG?.E20?.damageTypes?.[damageType] ?? damageType)}</button>`;
    }

    rows.push(row);
  }

  await globalThis.ChatMessage.create({
    speaker: globalThis.ChatMessage.getSpeaker({ actor: holder }),
    rolls: [roll],
    content: `<div class="e20-check-card"><p>${escape(T('DieAdded', {
      name: holder.name, die, bonus: roll.total, total: results[0]?.total ?? (message.rolls[0].total + roll.total),
    }))}</p><ul class="e20-check-results">${rows.join('')}</ul></div>`,
  });
  return roll;
}

/** Take one from an offer's pool (the holder's mark count). */
async function drawFromPool(rule, holder) {
  if (!rule.pool?.mark) {
    return;
  }

  const mark = holder.flags?.essence20?.ruleMarks?.[rule.pool.mark];
  if (mark) {
    await write(holder, 'update', [{ [`flags.essence20.ruleMarks.${rule.pool.mark}.count`]: Math.max(0, (Number(mark.count) || 1) - 1) }]);
  }
}

/**
 * Press an offer on a card: check it still holds, pay, do it, count it, run its steps.
 * @returns {Promise<Boolean>}   Whether it went ahead.
 */
export async function pressOffer(message, { holderUuid, itemId, index }, user = globalThis.game?.user) {
  const holder = lookup(holderUuid);
  const item = holder?.items?.get?.(itemId) ?? listOf(holder?.items).find(i => i.id == itemId);
  const offer = offersFor(message, holder ? [holder] : [], user).find(o => o.item === item && o.index == Number(index));
  if (!offer) {
    globalThis.ui?.notifications?.warn?.(T('OfferGone'));
    return false;
  }

  const { rule } = offer;
  const amount = costOf(rule, holder, item, offer.index);
  if (!(await affordable(rule, holder, item, amount)) || !(await pay(rule, holder, item, amount))) {
    if (rule.cost?.resource?.gmStoryPoints) {
      return false;
    }

    globalThis.ui?.notifications?.warn?.(T('CannotPay', { name: holder.name }));
    return false;
  }

  const used = usedSoFar(rule, holder, item, offer.index);
  if (rule.limit?.per) {
    await recordUse(holder, rule, item, offer.index);
  }

  if (rule.counter?.per && !rule.limit?.per) {
    await recordUse(holder, { limit: { ...rule.counter, key: rule.counter.key } }, item, offer.index);
  }

  await drawFromPool(rule, holder);
  const roller = speakerOf(message);
  const title = `${roller?.name ?? ''}: ${item?.name ?? ''}`;
  let total = null;
  if (rule.reroll) {
    const target = rule.reroll.target ?? 'd20';
    const roll = target == 'formula' ? await rerollFormula(message, rule.reroll.keep ?? 'new', holder, rule.reroll.keep == 'choose' ? item?.name ?? '' : T('Rerolled', { name: holder.name, item: item?.name ?? '' }))
      : await rerollCheck(message, target, title);
    total = roll ? Number(roll.total) : null;
  } else if (rule.addDie) {
    total = Number((await addDie(message, dieOf(rule, holder, item), holder))?.total) || null;
  }

  if (Array.isArray(rule.steps) && rule.steps.length) {
    const ctx = stepContext({ actor: holder, item, rule, targets: roller ? [roller] : [] });
    Object.assign(ctx.vars, { used, ...(total === null ? {} : { total }) });
    ctx.card = null;
    ctx.offerMessage = message;
    await runSteps(rule.steps, ctx);
    if (ctx.chat.length) {
      await say(holder, [`<strong>${escape(item?.name ?? '')}</strong>`, ...ctx.chat].join('<br>'));
    }
  }

  return true;
}

// markCard {key}: the card this offer was pressed on remembers it (card:marked:<key>) - "made a Fumble", "already
// answered". Only in a CardOffer's steps.
registerStep('markCard', async (step, ctx) => {
  const message = ctx.offerMessage;
  if (!message) {
    return false;
  }

  await write(message, 'update', [{ [`flags.essence20.ruleCardMarks.${step.key}`]: true }]);
}, { errors: (step, where) => (step.key ? [] : [`${where}: markCard needs a key`]) });

/* -------------------------------------------- */
/*  Chat wiring                                  */
/* -------------------------------------------- */

export function decorateOffers(message, element) {
  if (!element?.querySelector || !message?.rolls?.length) {
    return;
  }

  const container = element.querySelector('.message-content') ?? element;
  for (const offer of offersFor(message)) {
    const key = `${offer.holder.uuid}|${offer.item.id}|${offer.index}`;
    if (listOf(element.querySelectorAll?.('[data-e20-offer]')).some(other => other.dataset.e20Offer == key)) {
      continue;
    }

    const button = globalThis.document.createElement('button');
    button.type = 'button';
    button.className = 'e20-chat-action-button';
    button.dataset.e20Ext = 'ruleCardOffer';
    button.dataset.e20Offer = key;
    button.dataset.holderUuid = offer.holder.uuid;
    button.dataset.itemId = offer.item.id;
    button.dataset.index = String(offer.index);
    button.textContent = offer.label;
    container.appendChild(button);
  }
}

registerChatDecorator(decorateOffers);
registerChatButton('ruleCardOffer', async (message, button) => {
  button.disabled = true;
  const done = await pressOffer(message, { holderUuid: button.dataset.holderUuid, itemId: button.dataset.itemId, index: button.dataset.index });
  button.disabled = !!done;
});

/* -------------------------------------------- */
/*  The rerolled event                           */
/* -------------------------------------------- */

/** A reroll's total fails when it reaches none of the original DIFs. */
export function stillFails(total, checkResults) {
  const difficulties = (checkResults ?? []).map(entry => Number(entry?.difficulty)).filter(Number.isFinite);
  return difficulties.length > 0 && difficulties.every(difficulty => total < difficulty);
}

/**
 * A Story Point reroll card (chat.mjs#rerollMessage, flags.essence20.rerollConfig.source) this user posted: the
 * speaker's rerolled Triggers, with the latest earlier check card of the same speaker as the original.
 */
export async function onRerollMessage(message, messages = listOf(globalThis.game?.messages)) {
  const authorId = message?.author?.id ?? message?.user?.id;
  const source = message?.flags?.essence20?.rerollConfig?.source;
  if (!source || authorId != globalThis.game?.user?.id) {
    return;
  }

  const actor = speakerOf(message);
  if (!actor) {
    return;
  }

  const index = messages.findIndex(m => m.id == message.id);
  const earlier = (index >= 0 ? messages.slice(0, index) : messages).reverse();
  const original = earlier.find(m => m.speaker?.actor == message.speaker?.actor && m.flags?.essence20?.checkResults?.length);
  const total = Number(message.rolls?.[0]?.total);
  const failed = original && Number.isFinite(total) && stillFails(total, original.flags.essence20.checkResults) ? 1 : 0;
  const { fireTriggers } = await import("../../triggers.mjs");
  await fireTriggers(actor, 'rerolled', {
    roll: { rolledSkill: original?.flags?.essence20?.skill },
    vars: { source: String(source), failed, ...(Number.isFinite(total) ? { total } : {}) },
  });
}

globalThis.Hooks?.on?.('createChatMessage', message => {
  onRerollMessage(message).catch(error => console.error('Essence20 | rerolled event failed', error));
});
