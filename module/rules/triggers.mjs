import {
  registerAfterDamage, registerMissionAdvanced, registerPostRoll, registerRest, registerRoundStart,
  registerSceneAdvanced, registerTurnEnd, registerTurnStart, registerUse,
} from "../helpers/extensions.mjs";
import { isItemActive, ruleLabel, rulesOf, rulesOfType } from "./index.mjs";
import { recordUse, restClears, usesLeft } from "./limits.mjs";
import { LINK_SCOPES, linkedEntries } from "./links.mjs";
import { contextFor, evaluate, isStatic } from "./predicate.mjs";
import { canAfford, changeResource, runSteps, stepContext } from "./steps.mjs";
import { resolveValue } from "./formula.mjs";

/**
 * Phase 2 of the rules engine (docs/RULES_ENGINE_PLAN.md §4.12-4.13): Use buttons and Triggers.
 *
 * A **Use** rule puts a Use button on its item - the same button every hand-written Use has
 * (helpers/action-perks.mjs, through helpers/extensions.mjs#registerUse). Pressing it checks the
 * rule's condition and limit, pays its cost (an action, then a resource), runs its steps and posts
 * what happened. An item with several Use rules asks which.
 *
 * A **Trigger** rule runs its steps when something happens to its actor: a turn starts or ends, a
 * round, a rest, a new scene or mission, damage taken, about to be Defeated (its steps can stop the
 * damage), Defeated, Morph or Alt Mode changes, or a roll. `prompt: true` asks first.
 */

/* -------------------------------------------- */
/*  Use                                          */
/* -------------------------------------------- */

/** An item's Use rules, with their positions. */
export function useRulesOf(item) {
  if (!isItemActive(item)) {
    return [];
  }

  return rulesOf(item).map((rule, index) => ({ rule, index })).filter(({ rule }) => rule?.type == 'Use' && !rule.disabled);
}

/**
 * Whether one Use can be pressed now: its condition isn't known false, its limit has a use left
 * and its resource can be paid.
 */
export function useAvailable(item, rule, index) {
  const actor = item?.parent;
  if (!actor) {
    return false;
  }

  if (isStatic(rule.when) && evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === false) {
    return false;
  }

  if (usesLeft(actor, rule, item, index) <= 0) {
    return false;
  }

  const amount = Math.round(resolveValue(rule.cost?.amount ?? 1, { actor, item }, 1));
  return canAfford(rule.cost?.resource, amount, { actor, item });
}

async function pickUse(item, available) {
  if (available.length == 1) {
    return available[0];
  }

  const { DialogV2 } = foundry.applications.api;
  const picked = await DialogV2.wait({
    window: { title: item.name },
    classes: ['essence20', 'e20-window'],
    buttons: available.map(({ rule }, i) => ({ action: String(i), label: rule.label || `${item.name} ${i + 1}` })),
    rejectClose: false,
  });
  return picked === null || picked === undefined ? null : available[Number(picked)];
}

/**
 * Press an item's Use button. Resolves to the chat line, or null when nothing happened.
 * @param {Item} item
 * @param {Function} pay   (actionType) => Promise<Boolean> - spends the action in combat.
 * @param {Object} [options]
 * @param {Function} [options.pick]   Which Use, when there are several (tests).
 */
/**
 * Whether a finished run uses up its limit. `limit.onlyOnSuccess`: only when the run's last roll
 * step succeeded - a failed attempt leaves the button free to try again.
 */
export function countsTowardLimit(rule, ctx) {
  return !rule.limit?.onlyOnSuccess || ctx.vars.lastRoll?.success !== false;
}

/** Steps that only choose who a Use is for - run before its cost is paid. (A `target` step keeps its old place: its "needs a target" card is posted after paying.) */
const PICK_FIRST = ['pickAlly'];

export async function runUse(item, pay, { pick = pickUse, ask = null } = {}) {
  const actor = item?.parent;
  const available = useRulesOf(item).filter(({ rule, index }) => useAvailable(item, rule, index));
  if (!actor || !available.length) {
    return null;
  }

  const chosen = await pick(item, available);
  if (!chosen) {
    return null;
  }

  const { rule, index } = chosen;
  const ctx = stepContext({ actor, item, rule, ask });
  // Picking the ally it's for comes first (pickAlly): a cancelled pick costs nothing.
  const steps = Array.isArray(rule.steps) ? rule.steps : [];
  const picks = steps.findIndex(step => !PICK_FIRST.includes(step?.do));
  const leading = picks < 0 ? steps : steps.slice(0, picks);
  if (leading.length && !(await runSteps(leading, ctx))) {
    return null;
  }

  const action = rule.cost?.action;
  if (action && action != 'none' && !(await pay(action))) {
    return null;
  }

  if (rule.cost?.resource) {
    const amount = Math.round(resolveValue(rule.cost.amount ?? 1, { actor, item }, 1));
    if (!(await changeResource(rule.cost.resource, -amount, ctx))) {
      return null;
    }
  }

  const finished = await runSteps(steps.slice(leading.length), ctx);
  if (finished && countsTowardLimit(rule, ctx)) {
    await recordUse(actor, rule, item, index);
  }

  // A run that stopped with nothing to say (a refused cost, a cancelled pick) posts no card.
  if (!finished && !ctx.chat.length) {
    return null;
  }

  const title = rule.label ? `${item.name}: ${rule.label}` : item.name;
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  return [`<strong>${escape(title)}</strong>`, ...ctx.chat].join('<br>');
}

registerUse({
  id: 'rules',
  matches: item => useRulesOf(item).length > 0,
  canUse: item => useRulesOf(item).some(({ rule, index }) => useAvailable(item, rule, index)),
  run: (item, economy, pay) => runUse(item, pay),
});

/* -------------------------------------------- */
/*  Trigger                                      */
/* -------------------------------------------- */

async function confirm(item, rule) {
  const { DialogV2 } = foundry.applications.api;
  return DialogV2.confirm({
    window: { title: item.name },
    content: `<p>${game.i18n.format('E20.Rules.TriggerPrompt', { name: ruleLabel(rule, item) })}</p>`,
    rejectClose: false,
  });
}

async function post(actor, lines) {
  if (lines.length && globalThis.ChatMessage?.create) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: lines.join('<br>') });
  }
}

/**
 * Run every Trigger on this actor for one event.
 * @param {Actor} actor
 * @param {String} event
 * @param {Object} [extra]   {roll: tag context, outcome, damage: {amount}, ask, prompt}
 * @returns {Promise<Object|null>}   The damage object, for wouldBeDefeated.
 */
export async function fireTriggers(actor, event, { roll = {}, outcome = null, facts = null, damage = null, targets = [], ask = null, prompt = confirm } = {}) {
  // An aura / party / vehicle Trigger fires for the actor it reaches, never for its holder; its
  // limit is the holder's ("once per encounter" for whoever holds the Perk).
  const own = rulesOfType(actor, 'Trigger').filter(entry => !LINK_SCOPES.includes(entry.rule.scope)).map(entry => ({ ...entry, holder: actor }));
  const reaching = linkedEntries(actor, 'Trigger');
  for (const { rule, item, index, holder } of [...own, ...reaching]) {
    if (rule.event != event) {
      continue;
    }

    if (['afterRoll', 'hit'].includes(event) && !outcomeMatches(rule.outcome, outcome, facts)) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ ...roll, self: actor, holder, ruleItem: item, other: targets[0] ?? null })) !== true) {
      continue;
    }

    if (usesLeft(holder, rule, item, index) <= 0) {
      continue;
    }

    if (rule.prompt && !(await prompt(item, rule))) {
      continue;
    }

    const ctx = stepContext({ actor, item, rule, targets, damage, ask });
    const finished = await runSteps(rule.steps, ctx);
    if (finished && countsTowardLimit(rule, ctx)) {
      await recordUse(holder, rule, item, index);
    }

    await post(actor, ctx.chat.length ? [`<strong>${ruleLabel(rule, item)}</strong>`, ...ctx.chat] : []);
  }

  return damage;
}

/** The actor's actors-with-Triggers sweep, for world-wide events. */
function worldActors() {
  return [...(globalThis.game?.actors ?? [])].filter(actor => rulesOfType(actor, 'Trigger').length);
}

/**
 * Damage about to land: a hit that would Defeat runs `wouldBeDefeated`, whose steps may change it.
 * Called by combat.mjs at the head of its Defeat-save chain - after immunity and every reduction, so
 * a save only spends itself on a hit that really would Defeat.
 */
export async function wouldBeDefeated(actor, amount, damageType, { isCrit = false } = {}) {
  const health = Number(actor?.system?.health?.value);
  const watching = [...rulesOfType(actor, 'Trigger'), ...linkedEntries(actor, 'Trigger')].some(e => e.rule.event == 'wouldBeDefeated');
  if (damageType == 'stun' || !(health > 0) || amount < health || !watching) {
    return amount;
  }

  const damage = { amount, damageType };
  await fireTriggers(actor, 'wouldBeDefeated', { damage, roll: { damageType, damageAmount: amount, damageCrit: !!isCrit } });
  return damage.amount;
}

/** A Trigger's `outcome`: "success" takes a Critical Success too, "failure" a Fumble too. */
/**
 * Whether a roll's result is the outcome a Trigger asks for. The first six read the summary
 * outcome (a crit counts before anything else); the rest read the results themselves (facts):
 *  - x2: some result succeeded by double the DIF (Degrees of Success x2+), a crit or not;
 *  - anyFailed / allFailed: some / every result failed, whatever the dice showed;
 *  - fumbled: a Fumble, even on a roll that also crit.
 */
function outcomeMatches(wanted, outcome, facts = null) {
  if (!wanted || wanted == 'any') {
    return true;
  }

  const results = Array.isArray(facts?.results) ? facts.results : [];
  switch (wanted) {
  case 'x2': return results.some(result => result?.success && Number(result.multiplier) >= 2);
  case 'anyFailed': return results.some(result => result && !result.success);
  case 'allFailed': return results.length > 0 && results.every(result => result && !result.success);
  case 'fumbled': return !!facts?.isFumble;
  }

  // double: a success by at least double the DIF (Degrees of Success x2 or more) - a crit counts too.
  return wanted == outcome || (wanted == 'success' && ['crit', 'double'].includes(outcome))
    || (wanted == 'double' && outcome == 'crit') || (wanted == 'failure' && outcome == 'fumble');
}

function rollOutcome(results, { isCrit, isFumble } = {}) {
  if (isCrit) {
    return 'crit';
  }

  if (isFumble) {
    return 'fumble';
  }

  const list = Array.isArray(results) ? results : [];
  if (!list.length) {
    return null;
  }

  if (list.some(result => result?.success && Number(result.multiplier) >= 2)) {
    return 'double';
  }

  return list.some(result => result?.success) ? 'success' : 'failure';
}

/** One target's outcome: its own Degrees of Success. */
function hitOutcome(hit, result, isCrit) {
  if (!hit) {
    return 'failure';
  }

  return isCrit ? 'crit' : Number(result?.multiplier) >= 2 ? 'double' : 'success';
}

/**
 * Items a step gave for a while (grant with `until`) go once that runs out. Swept when turns and
 * rounds change and scenes start - the points at which one can run out.
 */
export async function sweepExpired(actor) {
  const { isExpired } = await import("./expiry.mjs");
  const items = actor?.items?.contents ?? [...(actor?.items ?? [])];
  const ids = items.filter(item => item.flags?.essence20?.rulesExpiry && isExpired(item.flags.essence20.rulesExpiry)).map(item => item.id);
  if (ids.length && actor.isOwner) {
    await actor.deleteEmbeddedDocuments('Item', ids);
  }

  return ids;
}

function holdsTimedItems(actor) {
  return (actor?.items?.contents ?? [...(actor?.items ?? [])]).some(item => item.flags?.essence20?.rulesExpiry);
}

async function sweepWorld() {
  for (const actor of globalThis.game?.actors ?? []) {
    if (holdsTimedItems(actor)) {
      await sweepExpired(actor);
    }
  }
}

registerTurnStart(async actor => {
  await sweepWorld();
  await fireTriggers(actor, 'turnStart');
});
registerTurnEnd(actor => fireTriggers(actor, 'turnEnd'));
registerRoundStart(async combat => {
  for (const combatant of combat?.combatants ?? []) {
    if (combatant.actor) {
      await fireTriggers(combatant.actor, 'roundStart');
    }
  }
});
registerRest(async actor => {
  const clears = restClears(actor);
  if (clears.length) {
    await actor.update(Object.fromEntries(clears.map(key => [key, null])));
  }

  await fireTriggers(actor, 'rest');
});
registerSceneAdvanced(async () => {
  await sweepWorld();
  for (const actor of worldActors()) {
    await fireTriggers(actor, 'sceneStart');
  }
});
registerMissionAdvanced(async () => {
  for (const actor of worldActors()) {
    await fireTriggers(actor, 'missionStart');
  }
});
registerAfterDamage(async (actor, dealt, damageType, { newValue, wasAlreadyDefeated } = {}) => {
  if (dealt > 0) {
    await fireTriggers(actor, 'takesDamage', { damage: { amount: dealt, damageType }, roll: { damageType, damageAmount: dealt } });
  }

  if (!wasAlreadyDefeated && Number(newValue) <= 0) {
    await fireTriggers(actor, 'defeated');
  }
});
registerPostRoll(async (actor, results, checkContext, extra = {}) => {
  const rider = extra.rider ?? checkContext?.riderContext ?? {};
  const item = rider.itemUuid ? globalThis.fromUuidSync?.(rider.itemUuid) ?? null : null;
  const roll = { item, rolledSkill: rider.skill, isAttack: item?.type == 'weaponEffect', isMelee: rider.style == 'melee', switches: rider.switches ?? [] };
  const facts = { results: Array.isArray(results) ? results : [], isCrit: !!extra.isCrit, isFumble: !!extra.isFumble };
  await fireTriggers(actor, 'afterRoll', { roll, outcome: rollOutcome(results, extra), facts });

  // Each target rolled against, hit or missed - its steps land on that target with `to: "target"`.
  // Any roll against a target's Defense counts: an attack, a spell, an Intimidation test...
  // (`attack` tags stay weapon-only; `item:own` / `skill:` narrow it down).
  for (const { target, hit, result } of extra.hits ?? []) {
    if (target) {
      await fireTriggers(actor, hit ? 'hit' : 'miss', {
        roll, outcome: hitOutcome(hit, result, extra.isCrit), targets: [target],
        facts: { results: [result ?? { success: !!hit }], isCrit: !!extra.isCrit, isFumble: !!extra.isFumble },
      });
    }
  }
});

// Combat starting and ending, Initiative being rolled, and Story Points being spent.
globalThis.Hooks?.on?.('combatStart', async combat => {
  for (const combatant of combat?.combatants ?? []) {
    if (combatant.actor) {
      await fireTriggers(combatant.actor, 'combatStart');
    }
  }
});
globalThis.Hooks?.on?.('deleteCombat', async (combat, options, userId) => {
  if (userId != globalThis.game?.user?.id || !combat?.started) {
    return;
  }

  for (const combatant of combat.combatants ?? []) {
    if (combatant.actor) {
      await fireTriggers(combatant.actor, 'combatEnd');
    }
  }
});
globalThis.Hooks?.on?.('updateCombatant', (combatant, changed, options, userId) => {
  if (userId == globalThis.game?.user?.id && changed?.initiative !== undefined && changed.initiative !== null && combatant.actor) {
    fireTriggers(combatant.actor, 'initiativeRolled');
  }
});
globalThis.Hooks?.on?.('essence20.storyPointSpent', (actor, amount) => {
  if (actor && amount > 0) {
    fireTriggers(actor, 'storyPointSpent');
  }
});

// A Condition arriving on an actor this user changed - 'conditionGained', with the Condition's id in
// the roll context so a Trigger can ask for it with self:status:<id>.
globalThis.Hooks?.on?.('createActiveEffect', (effect, options, userId) => {
  const actor = effect?.parent;
  if (userId != globalThis.game?.user?.id || actor?.documentName != 'Actor' || !effect.statuses?.size) {
    return;
  }

  fireTriggers(actor, 'conditionGained');
});

globalThis.Hooks?.on?.('updateActor', (actor, changed, options, userId) => {
  if (userId != globalThis.game?.user?.id) {
    return;
  }

  const has = path => globalThis.foundry?.utils?.hasProperty?.(changed ?? {}, path);
  if (has('system.isMorphed')) {
    fireTriggers(actor, actor.system?.isMorphed ? 'morph' : 'unmorph');
  }

  if (has('system.isTransformed')) {
    fireTriggers(actor, actor.system?.isTransformed ? 'transform' : 'untransform');
  }
});

/** An item just added to an actor runs its own 'added' Triggers - only that item's, not the actor's others. */
export async function fireItemAdded(actor, item, options = {}) {
  const own = rulesOf(item).filter(rule => rule?.type == 'Trigger' && rule.event == 'added' && !rule.disabled);
  for (const rule of own) {
    if (evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) !== true) {
      continue;
    }

    const ctx = stepContext({ actor, item, rule, targets: [], ask: options.ask ?? null });
    await runSteps(rule.steps, ctx);
    await post(actor, ctx.chat.length ? [`<strong>${ruleLabel(rule, item)}</strong>`, ...ctx.chat] : []);
  }
}

export { rollOutcome };
